import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/assessments
// Returns assessments assigned to the current user (via direct, role, or dept assignment)
// along with their most recent attempt summary.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId, tenantId, roles = [] } = session.user;

  const user = await db.user.findUnique({ where: { id: userId }, select: { departmentId: true } });

  const assignments = await db.assessmentAssignment.findMany({
    where: {
      tenantId,
      OR: [
        { userId },
        { roleName: { in: roles } },
        ...(user?.departmentId ? [{ departmentId: user.departmentId }] : []),
      ],
    },
    include: {
      assessment: {
        select: {
          id: true, title: true, description: true, type: true, status: true,
          passingScore: true, maxAttempts: true, timeLimitMinutes: true,
          _count: { select: { questions: true } },
        },
      },
    },
  });

  // Deduplicate assessments
  const seenIds = new Set<string>();
  const assessments = assignments
    .filter((a) => {
      if (seenIds.has(a.assessmentId) || a.assessment.status !== "PUBLISHED") return false;
      seenIds.add(a.assessmentId);
      return true;
    })
    .map((a) => ({ ...a.assessment, dueDate: a.dueDate }));

  // Attach latest attempt per assessment
  const attemptMap = new Map<string, { status: string; score: number | null; submittedAt: Date | null }>();
  if (assessments.length > 0) {
    const attempts = await db.assessmentAttempt.findMany({
      where: { userId, assessmentId: { in: assessments.map((a) => a.id) } },
      orderBy: { startedAt: "desc" },
    });
    for (const attempt of attempts) {
      if (!attemptMap.has(attempt.assessmentId)) {
        attemptMap.set(attempt.assessmentId, {
          status: attempt.status,
          score: attempt.score,
          submittedAt: attempt.submittedAt,
        });
      }
    }
  }

  const result = assessments.map((a) => ({
    ...a,
    latestAttempt: attemptMap.get(a.id) ?? null,
  }));

  return NextResponse.json(result);
}
