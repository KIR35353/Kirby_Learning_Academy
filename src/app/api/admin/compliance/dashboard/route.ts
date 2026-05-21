import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER", "MANAGER"].includes(r));
}

// GET /api/admin/compliance/dashboard
// Returns org-wide compliance summary: status counts, expiring soon, by framework
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId");

  const [statusCounts, expiringRecords, frameworkSummary, recentAuditLogs] = await Promise.all([
    // Status distribution across all records
    db.certificationRecord.groupBy({
      by: ["status"],
      where: { tenantId: session.user.tenantId, ...(departmentId ? { user: { departmentId } } : {}) },
      _count: { status: true },
    }),

    // Expiring soon: next 90 days
    db.certificationRecord.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: { in: ["VALID", "EXPIRING_SOON"] },
        expiresAt: {
          not: null,
          lte: new Date(Date.now() + 90 * 86400000),
          gte: new Date(),
        },
        ...(departmentId ? { user: { departmentId } } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, department: { select: { name: true } } } },
        certification: { select: { id: true, name: true, framework: true } },
      },
      orderBy: { expiresAt: "asc" },
      take: 50,
    }),

    // Records grouped by framework
    db.$queryRawUnsafe<{ framework: string; status: string; count: bigint }[]>(`
      SELECT c.framework, cr.status, COUNT(*) as count
      FROM certification_records cr
      JOIN certifications c ON c.id = cr."certificationId"
      WHERE cr."tenantId" = '${session.user.tenantId}'
      GROUP BY c.framework, cr.status
      ORDER BY c.framework, cr.status
    `),

    // Recent audit events
    db.auditLog.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        actor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const s of statusCounts) statusMap[s.status] = s._count.status;

  return NextResponse.json({
    summary: {
      PENDING: statusMap["PENDING"] ?? 0,
      VALID: statusMap["VALID"] ?? 0,
      EXPIRING_SOON: statusMap["EXPIRING_SOON"] ?? 0,
      EXPIRED: statusMap["EXPIRED"] ?? 0,
      SUSPENDED: statusMap["SUSPENDED"] ?? 0,
    },
    expiringRecords,
    frameworkSummary: frameworkSummary.map((r) => ({
      framework: r.framework,
      status: r.status,
      count: Number(r.count),
    })),
    recentAuditLogs,
  });
}
