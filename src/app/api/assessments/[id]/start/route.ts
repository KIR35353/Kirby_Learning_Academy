import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// POST /api/assessments/[id]/start
// Creates a new attempt. Validates maxAttempts and sets expiresAt for timed assessments.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: assessmentId } = await params;
  const { id: userId, tenantId } = session.user;

  const assessment = await db.standaloneAssessment.findFirst({
    where: { id: assessmentId, tenantId, status: "PUBLISHED" },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" }, select: { id: true, text: true, order: true } } },
      },
    },
  });

  if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

  // Check maxAttempts
  if (assessment.maxAttempts !== null) {
    const attemptCount = await db.assessmentAttempt.count({
      where: { assessmentId, userId, status: { in: ["PASSED", "FAILED"] } },
    });
    if (attemptCount >= assessment.maxAttempts) {
      return NextResponse.json({ error: "Maximum attempts reached" }, { status: 409 });
    }
  }

  // Abandon any previous IN_PROGRESS attempt
  await db.assessmentAttempt.updateMany({
    where: { assessmentId, userId, status: "IN_PROGRESS" },
    data: { status: "ABANDONED" },
  });

  const expiresAt = assessment.timeLimitMinutes
    ? new Date(Date.now() + assessment.timeLimitMinutes * 60000)
    : null;

  let questions = assessment.questions;

  // Randomize and/or limit questions if configured
  if (assessment.randomizeQuestions) {
    questions = [...questions].sort(() => Math.random() - 0.5);
  }
  if (assessment.questionsPerAttempt && questions.length > assessment.questionsPerAttempt) {
    questions = questions.slice(0, assessment.questionsPerAttempt);
  }

  const attempt = await db.assessmentAttempt.create({
    data: { assessmentId, userId, tenantId, expiresAt },
  });

  return NextResponse.json({
    attemptId: attempt.id,
    expiresAt: attempt.expiresAt,
    assessment: {
      id: assessment.id,
      title: assessment.title,
      description: assessment.description,
      type: assessment.type,
      passingScore: assessment.passingScore,
      timeLimitMinutes: assessment.timeLimitMinutes,
    },
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      points: q.points,
      order: q.order,
      // Options returned WITHOUT isCorrect — hidden during attempt
      options: q.options,
    })),
  });
}

const submitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedOptionIds: z.array(z.string()).default([]),
      acknowledged: z.boolean().default(false),
    })
  ),
});

// POST /api/assessments/[id]/submit (with attemptId in body)
// Actually we handle this in [id]/attempts/[attemptId]/submit route
export { POST as startAttempt };
