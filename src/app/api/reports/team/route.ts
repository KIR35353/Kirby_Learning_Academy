import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";

function isManager(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER", "MANAGER"].includes(r));
}

// GET /api/reports/team
// Returns completion + cert summary for users within the authenticated manager's org scope
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isManager(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId") ?? undefined;

  const users = await db.user.findMany({
    where: {
      tenantId: session.user.tenantId,
      isActive: true,
      ...(departmentId ? { departmentId } : {}),
    },
    select: {
      id: true, name: true, email: true,
      department: { select: { name: true } },
      jobTitle: { select: { name: true } },
      enrollments: {
        select: { status: true, score: true, passed: true, dueDate: true, completedAt: true },
      },
      certificationRecords: {
        select: { status: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  const now = new Date();

  const teamData = users.map((u) => {
    const total = u.enrollments.length;
    const completed = u.enrollments.filter((e) => ["PASSED", "COMPLETED"].includes(e.status)).length;
    const overdue = u.enrollments.filter((e) =>
      ["NOT_STARTED", "IN_PROGRESS"].includes(e.status) && e.dueDate && e.dueDate < now
    ).length;
    const expiring = u.certificationRecords.filter((c) => c.status === "EXPIRING_SOON").length;
    const expired = u.certificationRecords.filter((c) => c.status === "EXPIRED").length;
    return {
      id: u.id, name: u.name, email: u.email,
      department: u.department?.name ?? null,
      jobTitle: u.jobTitle?.name ?? null,
      enrollments: { total, completed, overdue, completionRate: total > 0 ? Math.round(completed / total * 100) : 0 },
      certs: { expiring, expired, total: u.certificationRecords.length },
    };
  });

  return NextResponse.json(teamData);
}
