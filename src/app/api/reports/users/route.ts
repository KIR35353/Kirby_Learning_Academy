import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "MANAGER", "COMPLIANCE_OFFICER"].includes(r));
}

function isSuperAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.includes("SUPER_ADMIN");
}

// GET /api/reports/users
// Returns active tenant users for user-report selection
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId") ?? undefined;
  const tenantIdParam = searchParams.get("tenantId") ?? undefined;

  // Super admins can query other tenants, others see only their own
  const tenantId = isSuperAdmin(session) && tenantIdParam ? tenantIdParam : session.user.tenantId;

  const users = await db.user.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(departmentId ? { departmentId } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      department: { select: { name: true } },
      jobTitle: { select: { name: true } },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 1000,
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      department: u.department?.name ?? null,
      jobTitle: u.jobTitle?.name ?? null,
    })),
  );
}
