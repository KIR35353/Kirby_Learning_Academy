import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER"].includes(r));
}

// GET /api/admin/compliance/export?framework=OSHA&status=EXPIRED&departmentId=xxx
// Returns CSV of certification records matching filters
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const framework = searchParams.get("framework");
  const status = searchParams.get("status");
  const departmentId = searchParams.get("departmentId");

  const records = await db.certificationRecord.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(status ? { status: status as "VALID" | "PENDING" | "EXPIRING_SOON" | "EXPIRED" | "SUSPENDED" } : {}),
      ...(framework ? { certification: { framework: framework as "OSHA" | "USCG" | "EPA" | "ISM_CODE" | "STCW" | "DOT" | "INTERNAL" } } : {}),
      ...(departmentId ? { user: { departmentId } } : {}),
    },
    include: {
      user: { select: { name: true, email: true, department: { select: { name: true } }, jobTitle: { select: { name: true } } } },
      certification: { select: { name: true, framework: true, type: true } },
      issuedBy: { select: { name: true } },
    },
    orderBy: [{ user: { name: "asc" } }, { certification: { name: "asc" } }],
    take: 5000,
  });

  // Build CSV
  const header = ["Employee", "Email", "Department", "Job Title", "Certification", "Framework", "Type", "Status", "Issued At", "Expires At", "Issued By", "Notes"].join(",");
  const rows = records.map((r) => [
    `"${r.user.name ?? ""}"`,
    `"${r.user.email}"`,
    `"${r.user.department?.name ?? ""}"`,
    `"${r.user.jobTitle?.name ?? ""}"`,
    `"${r.certification.name}"`,
    `"${r.certification.framework}"`,
    `"${r.certification.type}"`,
    `"${r.status}"`,
    `"${r.issuedAt?.toISOString() ?? ""}"`,
    `"${r.expiresAt?.toISOString() ?? ""}"`,
    `"${r.issuedBy?.name ?? ""}"`,
    `"${(r.notes ?? "").replace(/"/g, '""')}"`,
  ].join(","));

  const csv = [header, ...rows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="compliance-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
