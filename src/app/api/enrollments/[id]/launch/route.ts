import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCourseBaseUrl } from "@/lib/s3";

/**
 * POST /api/enrollments/[id]/launch
 *
 * Records the launch (sets startedAt, status → IN_PROGRESS) and returns
 * the URL to CBT_Introduction.html so the client can open the launcher iframe.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const enrollment = await db.enrollment.findFirst({
    where: { id, userId: session.user.id },
    include: {
      course: {
        include: { activeVersion: { select: { id: true, s3Prefix: true, versionNumber: true } } },
      },
    },
  });

  if (!enrollment) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  if (enrollment.course.status !== "PUBLISHED")
    return NextResponse.json({ error: "Course is not published" }, { status: 409 });

  // Check learning path prerequisites
  const learningPathCourses = await db.learningPathCourse.findMany({
    where: { courseId: enrollment.courseId, prerequisiteCourseId: { not: null } },
    select: { prerequisiteCourseId: true },
  });

  if (learningPathCourses.length > 0) {
    const prereqCourseIds = learningPathCourses
      .map((lpc) => lpc.prerequisiteCourseId!)
      .filter(Boolean);

    const passedPrereqs = await db.enrollment.count({
      where: {
        userId: session.user.id,
        courseId: { in: prereqCourseIds },
        status: { in: ["PASSED", "COMPLETED"] },
      },
    });

    if (passedPrereqs < prereqCourseIds.length) {
      return NextResponse.json(
        { error: "Prerequisite course not yet completed" },
        { status: 403 }
      );
    }
  }

  // Always use the active version so re-imported content reaches learners immediately.
  const activeVersion = enrollment.course.activeVersion;
  const s3Prefix = activeVersion?.s3Prefix;

  if (!s3Prefix) {
    return NextResponse.json({ error: "No course content uploaded yet" }, { status: 409 });
  }

  // Mark as IN_PROGRESS on first launch; record startedAt.
  // Also pin courseVersionId to the active version (update if stale).
  const versionUpdate = activeVersion?.id && activeVersion.id !== enrollment.courseVersionId
    ? { courseVersionId: activeVersion.id }
    : {};

  if (enrollment.status === "NOT_STARTED") {
    await db.enrollment.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
        attempts: { increment: 1 },
        ...versionUpdate,
      },
    });
  } else if (enrollment.status === "IN_PROGRESS" || enrollment.status === "FAILED") {
    await db.enrollment.update({
      where: { id },
      data: { attempts: { increment: 1 }, ...versionUpdate },
    });
  } else if (Object.keys(versionUpdate).length > 0) {
    // PASSED/COMPLETED but version is stale — update silently
    await db.enrollment.update({ where: { id }, data: versionUpdate });
  }

  // Build the URL to CBT_Introduction.html
  // In local dev (MinIO), courses are publicly readable at the bucket URL.
  // In production, swap for a presigned URL via getPresignedUrl().
  const baseUrl = getCourseBaseUrl(s3Prefix);
  const launchUrl = `${baseUrl}CBT_Introduction.html`;

  return NextResponse.json({
    launchUrl,
    enrollmentId: id,
    courseId: enrollment.courseId,
    courseTitle: enrollment.course.title,
  });
}
