import { db } from "@/lib/db";
import { parse } from "date-fns";

/**
 * Worker: Daily User Stats Materialization
 * Runs daily at 2:00 UTC to calculate and store user performance metrics
 * for faster reporting queries
 *
 * Metrics aggregated:
 * - Login counts (successful / failed)
 * - Course status counts and completion rate
 * - Assessment metrics (pass rate, average score)
 */

export async function generateDailyUserStats() {
  console.log("[worker:daily_user_stats] Starting daily stats materialization");
  
  const now = new Date();
  const statDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  
  // Get all active tenants
  const tenants = await db.tenant.findMany({
    select: { id: true },
  });

  let totalProcessed = 0;
  let totalErrors = 0;

  for (const tenant of tenants) {
    try {
      // Get all active users in tenant
      const users = await db.user.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
        },
        select: { id: true },
      });

      for (const user of users) {
        try {
          const stats = await calculateUserStatsForDate(
            tenant.id,
            user.id,
            statDate,
          );

          // Upsert (replace if exists)
          await db.dailyUserStats.upsert({
            where: {
              tenantId_userId_statDate: {
                tenantId: tenant.id,
                userId: user.id,
                statDate,
              },
            },
            update: stats,
            create: {
              tenantId: tenant.id,
              userId: user.id,
              statDate,
              ...stats,
            },
          });

          totalProcessed++;
        } catch (err) {
          console.error(
            `[worker:daily_user_stats] Error processing user ${user.id} in tenant ${tenant.id}:`,
            err,
          );
          totalErrors++;
        }
      }
    } catch (err) {
      console.error(
        `[worker:daily_user_stats] Error processing tenant ${tenant.id}:`,
        err,
      );
      totalErrors++;
    }
  }

  console.log(
    `[worker:daily_user_stats] Completed: ${totalProcessed} records, ${totalErrors} errors`,
  );
  return { processed: totalProcessed, errors: totalErrors };
}

async function calculateUserStatsForDate(
  tenantId: string,
  userId: string,
  statDate: Date,
): Promise<{
  successfulLogins: number;
  failedLogins: number;
  coursesCompleted: number;
  coursesInProgress: number;
  coursesFailed: number;
  coursesOverdue: number;
  courseCompletionRate: number;
  assessmentsPassed: number;
  assessmentsFailed: number;
  assessmentPassRate: number;
  assessmentAvgScore: number | null;
}> {
  const dayEnd = new Date(statDate);
  dayEnd.setUTCHours(23, 59, 59, 999);

  // ── Login metrics ──
  const successfulLogins = await db.session.count({
    where: {
      userId,
      createdAt: { lte: dayEnd },
    },
  });

  const failedLogins = await db.authEvent.count({
    where: {
      userId,
      tenantId,
      eventType: "LOGIN_FAILED",
      createdAt: { lte: dayEnd },
    },
  });

  // ── Course metrics ──
  const enrollmentStatus = await db.enrollment.groupBy({
    by: ["status"],
    where: {
      userId,
      tenantId,
      completedAt: { lte: dayEnd },
    },
    _count: { status: true },
  });

  const statusCounts: Record<string, number> = {};
  for (const row of enrollmentStatus) {
    statusCounts[row.status] = row._count.status;
  }

  const coursesCompleted = (statusCounts.COMPLETED ?? 0) + (statusCounts.PASSED ?? 0);
  const coursesInProgress = statusCounts.IN_PROGRESS ?? 0;
  const coursesFailed = statusCounts.FAILED ?? 0;
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const courseCompletionRate = total > 0 ? Math.round((coursesCompleted / total) * 100) : 0;

  // Overdue courses (not completed, due before today)
  const coursesOverdue = await db.enrollment.count({
    where: {
      userId,
      tenantId,
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      dueDate: { lt: statDate },
    },
  });

  // ── Assessment metrics ──
  const assessmentStatus = await db.assessmentAttempt.groupBy({
    by: ["status"],
    where: {
      userId,
      tenantId,
      submittedAt: { lte: dayEnd },
    },
    _count: { status: true },
  });

  const assessmentCounts: Record<string, number> = {};
  for (const row of assessmentStatus) {
    assessmentCounts[row.status] = row._count.status;
  }

  const assessmentsPassed = assessmentCounts.PASSED ?? 0;
  const assessmentsFailed = assessmentCounts.FAILED ?? 0;
  const totalSubmitted = assessmentsPassed + assessmentsFailed;
  const assessmentPassRate =
    totalSubmitted > 0 ? Math.round((assessmentsPassed / totalSubmitted) * 100) : 0;

  const avgScoreResult = await db.assessmentAttempt.aggregate({
    where: {
      userId,
      tenantId,
      submittedAt: { lte: dayEnd },
    },
    _avg: { score: true },
  });

  const assessmentAvgScore =
    avgScoreResult._avg.score !== null
      ? Math.round(avgScoreResult._avg.score * 10) / 10
      : null;

  return {
    successfulLogins,
    failedLogins,
    coursesCompleted,
    coursesInProgress,
    coursesFailed,
    coursesOverdue,
    courseCompletionRate,
    assessmentsPassed,
    assessmentsFailed,
    assessmentPassRate,
    assessmentAvgScore,
  };
}
