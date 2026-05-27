import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const enrollSchema = z.object({
  courseId: z.string(),
  dueDate: z.string().datetime().optional(),
});

// GET /api/enrollments — list the current user's enrollments
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const enrollments = await db.enrollment.findMany({
    where: {
      userId: session.user.id,
      tenantId: session.user.tenantId,
      ...(status ? { status: status as never } : {}),
    },
    include: {
      course: {
        include: {
          activeVersion: { select: { versionNumber: true, s3Prefix: true } },
          tags: true,
        },
      },
      courseVersion: { select: { versionNumber: true } },
      assignedBy: { select: { name: true, email: true } },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json(enrollments);
}

// POST /api/enrollments — self-enroll in a published course
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = enrollSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { courseId, dueDate } = parsed.data;

  // Verify the course is published in the user's tenant
  const course = await db.course.findFirst({
    where: {
      id: courseId,
      status: "PUBLISHED",
      courseTenants: { some: { tenantId: session.user.tenantId } },
    },
    include: { activeVersion: { select: { id: true } } },
  });
  if (!course) return NextResponse.json({ error: "Course not found or not published" }, { status: 404 });

  // Upsert: if already enrolled, return existing enrollment
  const enrollment = await db.enrollment.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    update: {}, // don't overwrite existing progress
    create: {
      userId: session.user.id,
      courseId,
      courseVersionId: course.activeVersion?.id ?? null,
      tenantId: session.user.tenantId,
      selfEnrolled: true,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
    include: { course: true },
  });

  return NextResponse.json(enrollment, { status: 201 });
}
