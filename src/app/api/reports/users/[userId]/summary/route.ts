import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "MANAGER", "COMPLIANCE_OFFICER"].includes(r));
}

type EnrollmentStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "PASSED" | "FAILED" | "EXPIRED";

function toDateOrDefault(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function calcCompletionRate(statusCounts: Partial<Record<EnrollmentStatus, number>>): number {
  const total = Object.values(statusCounts).reduce((acc, v) => acc + (v ?? 0), 0);
  const completed = (statusCounts.PASSED ?? 0) + (statusCounts.COMPLETED ?? 0);
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

// GET /api/reports/users/[userId]/summary
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const { searchParams } = new URL(req.url);

  const rangeEnd = toDateOrDefault(searchParams.get("endDate"), new Date());
  const defaultStart = new Date(rangeEnd);
  defaultStart.setDate(defaultStart.getDate() - 90);
  const rangeStart = toDateOrDefault(searchParams.get("startDate"), defaultStart);

  const user = await db.user.findFirst({
    where: {
      id: userId,
      tenantId: session.user.tenantId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      department: { select: { name: true } },
      jobTitle: { select: { name: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();

  const [
    sessionCount,
    lastSession,
    enrollmentStatusGroup,
    overdueCount,
    completionsInWindow,
    assessmentStatusGroup,
    assessmentScoreAgg,
    recentSessions,
    recentCompletedEnrollments,
    recentAssessments,
    usersInScope,
    enrollmentStatusByUser,
    failedLoginCount,
  ] = await Promise.all([
    db.session.count({
      where: {
        userId,
        createdAt: { gte: rangeStart, lte: rangeEnd },
      },
    }),
    db.session.findFirst({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.enrollment.groupBy({
      by: ["status"],
      where: {
        userId,
        tenantId: session.user.tenantId,
      },
      _count: { status: true },
    }),
    db.enrollment.count({
      where: {
        userId,
        tenantId: session.user.tenantId,
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
    }),
    db.enrollment.count({
      where: {
        userId,
        tenantId: session.user.tenantId,
        status: { in: ["PASSED", "COMPLETED"] },
        completedAt: { gte: rangeStart, lte: rangeEnd },
      },
    }),
    db.assessmentAttempt.groupBy({
      by: ["status"],
      where: {
        userId,
        tenantId: session.user.tenantId,
        startedAt: { gte: rangeStart, lte: rangeEnd },
      },
      _count: { status: true },
    }),
    db.assessmentAttempt.aggregate({
      where: {
        userId,
        tenantId: session.user.tenantId,
        startedAt: { gte: rangeStart, lte: rangeEnd },
      },
      _avg: { score: true },
    }),
    db.session.findMany({
      where: {
        userId,
        createdAt: { gte: rangeStart, lte: rangeEnd },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.enrollment.findMany({
      where: {
        userId,
        tenantId: session.user.tenantId,
        status: { in: ["PASSED", "COMPLETED", "FAILED"] },
        completedAt: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        status: true,
        completedAt: true,
        course: { select: { title: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 12,
    }),
    db.assessmentAttempt.findMany({
      where: {
        userId,
        tenantId: session.user.tenantId,
        startedAt: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        status: true,
        score: true,
        submittedAt: true,
        startedAt: true,
        assessment: { select: { title: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 12,
    }),
    db.user.findMany({
      where: {
        tenantId: session.user.tenantId,
        isActive: true,
      },
      select: { id: true, name: true, email: true },
      take: 5000,
    }),
    db.enrollment.groupBy({
      by: ["userId", "status"],
      where: {
        tenantId: session.user.tenantId,
        user: { isActive: true },
      },
      _count: { status: true },
    }),
    db.authEvent.count({
      where: {
        userId,
        tenantId: session.user.tenantId,
        eventType: "LOGIN_FAILED",
        createdAt: { gte: rangeStart, lte: rangeEnd },
      },
    }),
  ]);

  const statusCounts: Partial<Record<EnrollmentStatus, number>> = {};
  for (const row of enrollmentStatusGroup) {
    statusCounts[row.status] = row._count.status;
  }

  const totalEnrollments = Object.values(statusCounts).reduce((acc, v) => acc + (v ?? 0), 0);
  const completedCount = (statusCounts.PASSED ?? 0) + (statusCounts.COMPLETED ?? 0);
  const completionRate = calcCompletionRate(statusCounts);

  const assessmentCounts: Record<string, number> = {};
  for (const row of assessmentStatusGroup) {
    assessmentCounts[row.status] = row._count.status;
  }

  const passedAttempts = assessmentCounts.PASSED ?? 0;
  const failedAttempts = assessmentCounts.FAILED ?? 0;
  const submittedAttempts = passedAttempts + failedAttempts;
  const passRate = submittedAttempts > 0 ? Math.round((passedAttempts / submittedAttempts) * 100) : 0;

  const byUser = new Map<
    string,
    {
      completed: number;
      total: number;
      rate: number;
    }
  >();

  for (const u of usersInScope) {
    byUser.set(u.id, { completed: 0, total: 0, rate: 0 });
  }

  for (const row of enrollmentStatusByUser) {
    const entry = byUser.get(row.userId) ?? { completed: 0, total: 0, rate: 0 };
    entry.total += row._count.status;
    if (row.status === "PASSED" || row.status === "COMPLETED") {
      entry.completed += row._count.status;
    }
    byUser.set(row.userId, entry);
  }

  const ranking = Array.from(byUser.entries()).map(([id, stats]) => ({
    userId: id,
    completed: stats.completed,
    total: stats.total,
    rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
  }));

  ranking.sort((a, b) => {
    if (b.rate !== a.rate) return b.rate - a.rate;
    if (b.completed !== a.completed) return b.completed - a.completed;
    return a.userId.localeCompare(b.userId);
  });

  const rankIndex = ranking.findIndex((r) => r.userId === userId);
  const rank = rankIndex >= 0 ? rankIndex + 1 : ranking.length;
  const percentile = ranking.length > 1
    ? Math.round((1 - (rank - 1) / (ranking.length - 1)) * 100)
    : 100;

  const activity = [
    ...recentSessions.map((s) => ({
      type: "LOGIN",
      label: "Successful login",
      timestamp: s.createdAt.toISOString(),
    })),
    ...recentCompletedEnrollments.map((e) => ({
      type: "COURSE",
      label: `${e.status === "FAILED" ? "Failed" : "Completed"}: ${e.course.title}`,
      timestamp: e.completedAt?.toISOString() ?? new Date(0).toISOString(),
    })),
    ...recentAssessments.map((a) => ({
      type: "ASSESSMENT",
      label: `${a.status}: ${a.assessment.title}${a.score !== null ? ` (${Math.round(a.score)}%)` : ""}`,
      timestamp: (a.submittedAt ?? a.startedAt).toISOString(),
    })),
  ]
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, 20);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department?.name ?? null,
      jobTitle: user.jobTitle?.name ?? null,
      joinedAt: user.createdAt,
    },
    dateRange: {
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
    },
    logins: {
      successful: sessionCount,
      failed: failedLoginCount,
      lastLoginAt: lastSession?.createdAt ?? null,
    },
    courses: {
      total: totalEnrollments,
      completed: completedCount,
      inProgress: statusCounts.IN_PROGRESS ?? 0,
      notStarted: statusCounts.NOT_STARTED ?? 0,
      failed: statusCounts.FAILED ?? 0,
      overdue: overdueCount,
      completionRate,
      completionsInWindow,
      byStatus: statusCounts,
    },
    assessments: {
      totalAttempts: Object.values(assessmentCounts).reduce((acc, v) => acc + v, 0),
      passed: passedAttempts,
      failed: failedAttempts,
      inProgress: assessmentCounts.IN_PROGRESS ?? 0,
      passRate,
      avgScore: assessmentScoreAgg._avg.score !== null
        ? Math.round(assessmentScoreAgg._avg.score * 10) / 10
        : null,
      byStatus: assessmentCounts,
    },
    ranking: {
      rank,
      totalUsers: ranking.length,
      percentile,
    },
    recentActivity: activity,
  });
}
