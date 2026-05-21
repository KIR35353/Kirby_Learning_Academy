import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { AssessmentClient } from "./_components/assessment-client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessment = await db.standaloneAssessment.findUnique({ where: { id }, select: { title: true } });
  return { title: assessment?.title ?? "Assessment" };
}

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const assessment = await db.standaloneAssessment.findUnique({
    where: { id, tenantId: session.user.tenantId },
    select: {
      id: true, title: true, description: true, type: true,
      passingScore: true, maxAttempts: true, timeLimitMinutes: true,
      remediationCourseId: true,
      remediationCourse: { select: { id: true, title: true } },
      _count: { select: { questions: true } },
    },
  });

  if (!assessment) redirect("/assessments");

  const attempts = await db.assessmentAttempt.findMany({
    where: { assessmentId: id, userId: session.user.id },
    orderBy: { startedAt: "desc" },
    select: { id: true, status: true, score: true, passed: true, startedAt: true, submittedAt: true },
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle={assessment.title} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <AssessmentClient assessment={assessment} initialAttempts={attempts} />
        </main>
      </div>
    </div>
  );
}
