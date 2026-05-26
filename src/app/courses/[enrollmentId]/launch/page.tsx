import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { LaunchClient } from "./_components/launch-client";

interface Props {
  params: Promise<{ enrollmentId: string }>;
}

export default async function LaunchPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { enrollmentId } = await params;

  const enrollment = await db.enrollment.findFirst({
    where: { id: enrollmentId, userId: session.user.id },
    include: {
      course: {
        include: { activeVersion: { select: { s3Prefix: true } } },
      },
    },
  });

  if (!enrollment) notFound();
  if (enrollment.course.status !== "PUBLISHED") redirect("/catalog");

  // Always serve from the currently-active version so re-imported content
  // (KLA_NAVIGATE, KLA_STOP listeners, etc.) reaches the learner immediately.
  // The enrollment's courseVersionId may be pinned to an older version.
  const s3Prefix = enrollment.course.activeVersion?.s3Prefix;

  if (!s3Prefix) redirect(`/catalog`);

  // Build the direct URL to the CBT entry point (MinIO: public read on courses/)
  // S3_PUBLIC_URL overrides S3_ENDPOINT for external browser access (e.g. Azure)
  const s3PublicBase = process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? "";
  const bucket = process.env.S3_BUCKET_NAME ?? "kirby-learning-academy-dev";
  const launchUrl = s3PublicBase
    ? `${s3PublicBase}/${bucket}/${s3Prefix}CBT_Introduction.html`
    : `https://${bucket}.s3.${process.env.S3_REGION ?? "us-east-1"}.amazonaws.com/${s3Prefix}CBT_Introduction.html`;

  return (
    <LaunchClient
      enrollmentId={enrollmentId}
      courseId={enrollment.courseId}
      courseTitle={enrollment.course.title}
      launchUrl={launchUrl}
      currentStatus={enrollment.status}
    />
  );
}
