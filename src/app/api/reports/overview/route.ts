import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "MANAGER"].includes(r));
}

// GET /api/reports/overview
// Returns org-wide KPIs for the admin/compliance dashboard
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId") ?? undefined;

  const userWhere = { tenantId, isActive: true, ...(departmentId ? { departmentId } : {}) };

  const [
    totalUsers,
    enrollmentCounts,
    certStatusCounts,
    recentCompletions,
    overdueEnrollments,
    topCourses,
    completionsByMonth,
  ] = await Promise.all([
    db.user.count({ where: userWhere }),

    db.enrollment.groupBy({
      by: ["status"],
      where: { tenantId, ...(departmentId ? { user: { departmentId } } : {}) },
      _count: { status: true },
    }),

    db.certificationRecord.groupBy({
      by: ["status"],
      where: { tenantId, ...(departmentId ? { user: { departmentId } } : {}) },
      _count: { status: true },
    }),

    db.enrollment.findMany({
      where: {
        tenantId,
        status: { in: ["PASSED", "FAILED", "COMPLETED"] },
        completedAt: { gte: new Date(Date.now() - 30 * 86400000) },
        ...(departmentId ? { user: { departmentId } } : {}),
      },
      include: {
        user: { select: { name: true } },
        course: { select: { title: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),

    db.enrollment.count({
      where: {
        tenantId,
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
        dueDate: { lt: new Date() },
        ...(departmentId ? { user: { departmentId } } : {}),
      },
    }),

    db.course.findMany({
      where: { tenantId },
      select: {
        id: true, title: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { enrollments: { _count: "desc" } },
      take: 5,
    }),

    // Completions per month over last 6 months using groupBy on completedAt month
    db.$queryRawUnsafe<{ month: string; count: bigint }[]>(`
      SELECT TO_CHAR("completedAt", 'YYYY-MM') as month, COUNT(*) as count
      FROM enrollments
      WHERE "tenantId" = '${tenantId}'
        AND "completedAt" >= NOW() - INTERVAL '6 months'
        ${departmentId ? `AND "userId" IN (SELECT id FROM users WHERE "departmentId" = '${departmentId}')` : ""}
      GROUP BY month
      ORDER BY month ASC
    `),
  ]);

  const enrMap: Record<string, number> = {};
  for (const e of enrollmentCounts) enrMap[e.status] = e._count.status;

  const certMap: Record<string, number> = {};
  for (const c of certStatusCounts) certMap[c.status] = c._count.status;

  const totalEnrollments = Object.values(enrMap).reduce((a, b) => a + b, 0);
  const completed = (enrMap["PASSED"] ?? 0) + (enrMap["FAILED"] ?? 0) + (enrMap["COMPLETED"] ?? 0);
  const completionRate = totalEnrollments > 0 ? Math.round((completed / totalEnrollments) * 100) : 0;

  return NextResponse.json({
    totalUsers,
    enrollments: {
      total: totalEnrollments,
      byStatus: enrMap,
      completionRate,
      overdue: overdueEnrollments,
    },
    certifications: {
      byStatus: certMap,
    },
    recentCompletions,
    topCourses: topCourses.map((c) => ({ id: c.id, title: c.title, enrollmentCount: c._count.enrollments })),
    completionsByMonth: completionsByMonth.map((r) => ({ month: r.month, count: Number(r.count) })),
  });
}
