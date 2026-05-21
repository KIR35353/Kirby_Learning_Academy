import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/reports/student — current user's own training summary
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;
  const now = new Date();

  const [enrollments, certRecords, skillCount, assessmentAttempts] = await Promise.all([
    db.enrollment.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, thumbnailUrl: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.certificationRecord.findMany({
      where: { userId },
      include: { certification: { select: { name: true, framework: true } } },
      orderBy: { issuedAt: "desc" },
      take: 10,
    }),
    db.userSkill.count({ where: { userId } }),
    db.assessmentAttempt.findMany({
      where: { userId },
      include: { assessment: { select: { title: true } } },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  const completed = enrollments.filter((e) => ["PASSED", "COMPLETED"].includes(e.status));
  const inProgress = enrollments.filter((e) => e.status === "IN_PROGRESS");
  const overdue = enrollments.filter(
    (e) => ["NOT_STARTED", "IN_PROGRESS"].includes(e.status) && e.dueDate && e.dueDate < now
  );
  const upcoming = enrollments.filter(
    (e) => ["NOT_STARTED", "IN_PROGRESS"].includes(e.status) && e.dueDate && e.dueDate >= now
  ).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1)).slice(0, 5);

  // Build completion history by month (last 6 months)
  const history: Record<string, number> = {};
  for (const e of completed) {
    if (e.completedAt) {
      const key = e.completedAt.toISOString().slice(0, 7);
      history[key] = (history[key] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    summary: {
      totalEnrollments: enrollments.length,
      completed: completed.length,
      inProgress: inProgress.length,
      overdue: overdue.length,
      skills: skillCount,
      completionRate: enrollments.length > 0
        ? Math.round(completed.length / enrollments.length * 100)
        : 0,
    },
    upcoming,
    overdue,
    recentCompletions: completed.slice(0, 5),
    certRecords,
    assessmentAttempts,
    completionHistory: Object.entries(history).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
  });
}
