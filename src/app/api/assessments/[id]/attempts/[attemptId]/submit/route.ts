import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const submitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedOptionIds: z.array(z.string()).default([]),
      acknowledged: z.boolean().default(false),
    })
  ),
});

// POST /api/assessments/[id]/attempts/[attemptId]/submit
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: assessmentId, attemptId } = await params;
  const { id: userId } = session.user;

  const attempt = await db.assessmentAttempt.findFirst({
    where: { id: attemptId, assessmentId, userId, status: "IN_PROGRESS" },
  });

  if (!attempt) return NextResponse.json({ error: "Attempt not found or already submitted" }, { status: 404 });

  // Check time limit
  if (attempt.expiresAt && new Date() > attempt.expiresAt) {
    await db.assessmentAttempt.update({ where: { id: attemptId }, data: { status: "ABANDONED" } });
    return NextResponse.json({ error: "Time limit exceeded" }, { status: 409 });
  }

  const body = await req.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Load questions with correct answers
  const assessment = await db.standaloneAssessment.findUnique({
    where: { id: assessmentId },
    select: { passingScore: true, remediationCourseId: true },
  });

  const questions = await db.question.findMany({
    where: { assessmentId },
    include: { options: true },
  });

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  let totalPoints = 0;
  let earnedPoints = 0;

  const gradedAnswers = parsed.data.answers.map((answer) => {
    const question = questionMap.get(answer.questionId);
    if (!question) return null;

    totalPoints += question.points;
    let isCorrect = false;
    let pointsEarned = 0;

    if (question.type === "ATTESTATION") {
      isCorrect = answer.acknowledged;
      pointsEarned = isCorrect ? question.points : 0;
    } else if (question.type === "MULTIPLE_CHOICE" || question.type === "TRUE_FALSE") {
      const correctOption = question.options.find((o) => o.isCorrect);
      isCorrect = correctOption ? answer.selectedOptionIds.includes(correctOption.id) : false;
      pointsEarned = isCorrect ? question.points : 0;
    } else if (question.type === "MULTI_SELECT") {
      const correctIds = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
      const selectedIds = new Set(answer.selectedOptionIds);
      // All correct selected AND no incorrect selected
      const allCorrectSelected = [...correctIds].every((id) => selectedIds.has(id));
      const noIncorrectSelected = [...selectedIds].every((id) => correctIds.has(id));
      isCorrect = allCorrectSelected && noIncorrectSelected;
      pointsEarned = isCorrect ? question.points : 0;
    }

    earnedPoints += pointsEarned;

    return {
      questionId: answer.questionId,
      selectedOptionIds: answer.selectedOptionIds,
      acknowledged: answer.acknowledged,
      isCorrect,
      pointsEarned,
    };
  }).filter(Boolean) as {
    questionId: string; selectedOptionIds: string[]; acknowledged: boolean;
    isCorrect: boolean; pointsEarned: number;
  }[];

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 100;
  const passed = score >= (assessment?.passingScore ?? 80);
  const status = passed ? "PASSED" : "FAILED";
  const now = new Date();

  // Save answers and update attempt in a transaction
  await db.$transaction([
    ...gradedAnswers.map((a) =>
      db.attemptAnswer.create({
        data: {
          attemptId,
          questionId: a.questionId,
          selectedOptionIds: a.selectedOptionIds,
          acknowledged: a.acknowledged,
          isCorrect: a.isCorrect,
          pointsEarned: a.pointsEarned,
        },
      })
    ),
    db.assessmentAttempt.update({
      where: { id: attemptId },
      data: { status, score, passed, submittedAt: now },
    }),
  ]);

  // Build results response including correct answers revealed
  const questionResults = questions
    .filter((q) => gradedAnswers.some((a) => a.questionId === q.id))
    .map((q) => {
      const answer = gradedAnswers.find((a) => a.questionId === q.id);
      return {
        id: q.id,
        type: q.type,
        text: q.text,
        explanation: q.explanation,
        points: q.points,
        isCorrect: answer?.isCorrect ?? false,
        pointsEarned: answer?.pointsEarned ?? 0,
        selectedOptionIds: answer?.selectedOptionIds ?? [],
        acknowledged: answer?.acknowledged ?? false,
        options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
      };
    });

  return NextResponse.json({
    attemptId,
    score,
    passed,
    status,
    submittedAt: now,
    earnedPoints,
    totalPoints,
    passingScore: assessment?.passingScore ?? 80,
    remediationCourseId: !passed ? assessment?.remediationCourseId : null,
    answers: gradedAnswers.map((a) => ({
      questionId: a.questionId,
      isCorrect: a.isCorrect,
      pointsEarned: a.pointsEarned,
      selectedOptionIds: a.selectedOptionIds,
      acknowledged: a.acknowledged,
      correctOptionIds: questions.find((q) => q.id === a.questionId)?.options.filter((o) => o.isCorrect).map((o) => o.id) ?? [],
      explanation: questions.find((q) => q.id === a.questionId)?.explanation ?? null,
    })),
    questions: questionResults,
  });
}

// GET /api/assessments/[id]/attempts/[attemptId]/submit — get saved result
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: assessmentId, attemptId } = await params;

  const attempt = await db.assessmentAttempt.findFirst({
    where: { id: attemptId, assessmentId, userId: session.user.id },
    include: {
      answers: {
        include: { question: { include: { options: true } } },
      },
      assessment: { select: { passingScore: true, title: true, remediationCourseId: true } },
    },
  });

  if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(attempt);
}
