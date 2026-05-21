import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/assessments/[id]/attempts — list user's attempts for this assessment
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: assessmentId } = await params;

  const attempts = await db.assessmentAttempt.findMany({
    where: { assessmentId, userId: session.user.id },
    orderBy: { startedAt: "desc" },
    select: {
      id: true, status: true, score: true, passed: true,
      startedAt: true, submittedAt: true, expiresAt: true,
    },
  });

  return NextResponse.json(attempts);
}
