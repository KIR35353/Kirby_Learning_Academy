import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/enrollments/[id]/reset
 *
 * Resets a completed/failed enrollment back to NOT_STARTED so the user can retake
 * the course. The learner may only reset their own enrollment; admins can reset any.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const enrollment = await db.enrollment.findUnique({
    where: { id },
    select: { id: true, userId: true, tenantId: true, status: true },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const isOwner = enrollment.userId === session.user.id;
  const isAdmin =
    (session.user.roles ?? []).some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "MANAGER"].includes(r));

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.enrollment.update({
    where: { id },
    data: {
      status: "NOT_STARTED",
      score: null,
      passed: null,
      completedAt: null,
      startedAt: null,
      attempts: 0,
    },
  });

  return NextResponse.json({ reset: true });
}
