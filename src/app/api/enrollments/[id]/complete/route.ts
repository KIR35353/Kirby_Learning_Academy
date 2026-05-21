import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const completeSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  passed: z.boolean().optional(),
});

/**
 * POST /api/enrollments/[id]/complete
 *
 * Called by the CBT launch page when it receives a KLA_COMPLETE postMessage.
 * Records the completion score and updates enrollment status to PASSED or FAILED.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const enrollment = await db.enrollment.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!enrollment) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });

  // Idempotent: don't overwrite a PASSED result with FAILED
  if (enrollment.status === "PASSED") {
    return NextResponse.json(enrollment);
  }

  const body = await req.json();
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { score, passed } = parsed.data;
  const finalPassed = passed ?? (score !== undefined ? score >= 80 : true);
  const newStatus = finalPassed ? "PASSED" : "FAILED";

  const updated = await db.enrollment.update({
    where: { id },
    data: {
      status: newStatus,
      score: score ?? null,
      passed: finalPassed,
      completedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
