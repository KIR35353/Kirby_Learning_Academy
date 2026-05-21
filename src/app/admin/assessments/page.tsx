import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { AssessmentsClient } from "./_components/assessments-client";

export const metadata = { title: "Assessments — Admin" };

export default async function AssessmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles ?? [];
  const allowed = roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "COMPLIANCE_OFFICER"].includes(r));
  if (!allowed) redirect("/unauthorized");

  const [assessments, courses, departments] = await Promise.all([
    db.standaloneAssessment.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        _count: { select: { questions: true, attempts: true, assignments: true } },
        remediationCourse: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.course.findMany({
      where: { tenantId: session.user.tenantId, status: "PUBLISHED" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    db.department.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Assessments" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <AssessmentsClient
            initialAssessments={assessments}
            availableCourses={courses}
            departments={departments}
          />
        </main>
      </div>
    </div>
  );
}
