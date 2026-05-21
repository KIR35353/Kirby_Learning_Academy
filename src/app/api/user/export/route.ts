import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/user/export — GDPR-compliant full user data export
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;

  const [
    user,
    enrollments,
    assessmentAttempts,
    certificationRecords,
    notifications,
    userSkills,
    userBadges,
    digitalCertificates,
    forumPosts,
    courseRatings,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, displayName: true,
        hireDate: true, isContractor: true, isActive: true, createdAt: true,
        department: { select: { name: true } },
        location: { select: { name: true } },
        jobTitle: { select: { name: true } },
        roles: { include: { role: { select: { name: true } } } },
      },
    }),
    db.enrollment.findMany({
      where: { userId },
      select: {
        id: true, status: true, dueDate: true, startedAt: true, completedAt: true,
        score: true, passed: true, createdAt: true,
        course: { select: { title: true } },
      },
    }),
    db.assessmentAttempt.findMany({
      where: { userId },
      select: {
        id: true, startedAt: true, submittedAt: true, score: true,
        passed: true,
        assessment: { select: { title: true } },
      },
    }),
    db.certificationRecord.findMany({
      where: { userId },
      select: {
        id: true, status: true, issuedAt: true, expiresAt: true, source: true, createdAt: true,
        certification: { select: { name: true, framework: true } },
      },
    }),
    db.notification.findMany({
      where: { userId },
      select: { id: true, type: true, title: true, isRead: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.userSkill.findMany({
      where: { userId },
      select: {
        level: true, source: true, grantedAt: true, endorsedById: true,
        skill: { select: { name: true } },
      },
    }),
    db.userBadge.findMany({
      where: { userId },
      select: { awardedAt: true, badge: { select: { name: true, trigger: true, points: true } } },
    }),
    db.digitalCertificate.findMany({
      where: { userId },
      select: { title: true, issuedAt: true, expiresAt: true, verifyCode: true },
    }),
    db.forumPost.findMany({
      where: { authorId: userId },
      select: { id: true, body: true, createdAt: true, thread: { select: { title: true } } },
    }),
    db.courseRating.findMany({
      where: { userId },
      select: { rating: true, comment: true, createdAt: true, course: { select: { title: true } } },
    }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    requestedBy: userId,
    profile: user,
    enrollments,
    assessmentAttempts,
    certificationRecords,
    notifications,
    skills: userSkills,
    badges: userBadges,
    digitalCertificates,
    forumPosts,
    courseRatings,
  };

  const json = JSON.stringify(exportData, null, 2);
  const filename = `kla-data-export-${userId}-${Date.now()}.json`;

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
