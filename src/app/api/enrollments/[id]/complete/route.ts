import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const completeSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  passed: z.boolean().optional(),
  // Analytics fields from CBT KLA_COMPLETE postMessage
  totalSeconds: z.number().int().nonnegative().nullable().optional(),
  sections: z.array(z.object({
    id: z.string(),
    views: z.number().int().nonnegative(),
    timeSpentSeconds: z.number().int().nonnegative(),
  })).nullable().optional(),
  questions: z.array(z.object({
    id: z.string(),
    stem: z.string(),
    correct: z.boolean(),
    timeSpentSeconds: z.number().int().nonnegative(),
  })).nullable().optional(),
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

  const { score, passed, totalSeconds, sections, questions } = parsed.data;
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

  // Persist analytics stats (upsert so a retry doesn't create duplicates)
  if (totalSeconds !== undefined || sections !== undefined || questions !== undefined) {
    await db.courseCompletionStats.upsert({
      where: { enrollmentId: id },
      create: {
        enrollmentId: id,
        userId: session.user.id!,
        courseId: enrollment.courseId,
        totalSeconds: totalSeconds ?? null,
        sectionStats: sections !== undefined ? (sections ?? Prisma.DbNull) : Prisma.DbNull,
        questionStats: questions !== undefined ? (questions ?? Prisma.DbNull) : Prisma.DbNull,
        rawPayload: body,
      },
      update: {
        totalSeconds: totalSeconds ?? null,
        sectionStats: sections !== undefined ? (sections ?? Prisma.DbNull) : Prisma.DbNull,
        questionStats: questions !== undefined ? (questions ?? Prisma.DbNull) : Prisma.DbNull,
        rawPayload: body,
      },
    });
  }

  // Auto-grant skills mapped to this course on pass
  if (finalPassed) {
    const courseSkills = await db.courseSkill.findMany({
      where: { courseId: enrollment.courseId },
    });
    for (const cs of courseSkills) {
      await db.userSkill.upsert({
        where: { userId_skillId: { userId: session.user.id!, skillId: cs.skillId } },
        update: { level: cs.levelGrant, source: "course_completion", sourceId: id },
        create: { userId: session.user.id!, skillId: cs.skillId, level: cs.levelGrant, source: "course_completion", sourceId: id },
      });
    }

    // Auto-issue or renew certifications that map this course as their renewalCourse
    const linkedCerts = await db.certification.findMany({
      where: { renewalCourseId: enrollment.courseId, tenantId: enrollment.tenantId, isActive: true },
    });
    for (const cert of linkedCerts) {
      const issuedAt = new Date();
      const expiresAt = cert.validityDays
        ? new Date(issuedAt.getTime() + cert.validityDays * 86400000)
        : null;

      const existing = await db.certificationRecord.findFirst({
        where: { certificationId: cert.id, userId: session.user.id! },
        orderBy: { createdAt: "desc" },
      });

      const record = await db.certificationRecord.create({
        data: {
          certificationId: cert.id,
          userId: session.user.id!,
          tenantId: enrollment.tenantId,
          status: "VALID",
          issuedAt,
          expiresAt,
          source: "course_completion",
          sourceId: id,
          renewedFromId: existing?.id ?? null,
        },
      });

      await db.certificationHistory.create({
        data: { recordId: record.id, fromStatus: existing?.status ?? null, toStatus: "VALID", reason: "Course completion" },
      });

      await db.auditLog.create({
        data: {
          tenantId: enrollment.tenantId,
          action: "CERT_ISSUED",
          actorId: session.user.id,
          targetId: session.user.id,
          entityId: record.id,
          entityType: "CertificationRecord",
          meta: { certName: cert.name, via: "course_completion", enrollmentId: id },
        },
      });
    }
  }

  return NextResponse.json(updated);
}
