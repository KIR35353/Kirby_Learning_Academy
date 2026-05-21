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
        include: { activeVersion: { select: { s3Prefix: true, versionNumber: true } } },
      },
      courseVersion: { select: { s3Prefix: true } },
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

  const s3Prefix =
    enrollment.courseVersion?.s3Prefix ??
    enrollment.course.activeVersion?.s3Prefix;

  if (!s3Prefix) {
    return NextResponse.json({ error: "No course content uploaded yet" }, { status: 409 });
  }

  // Mark as IN_PROGRESS on first launch; record startedAt
  if (enrollment.status === "NOT_STARTED") {
    await db.enrollment.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  } else if (enrollment.status === "IN_PROGRESS" || enrollment.status === "FAILED") {
    // Re-launch: increment attempts
    await db.enrollment.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
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
