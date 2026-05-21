import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { SkillsClient } from "./_components/skills-client";

export const metadata = { title: "Skills Library — Admin" };

export default async function SkillsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles ?? [];
  const allowed = roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "COMPLIANCE_OFFICER"].includes(r));
  if (!allowed) redirect("/unauthorized");

  const [skills, categories, jobTitles, courses] = await Promise.all([
    db.skill.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        category: { select: { id: true, name: true } },
        courseSkills: { include: { course: { select: { id: true, title: true } } } },
        roleRequirements: { include: { jobTitle: { select: { id: true, name: true } } } },
        _count: { select: { userSkills: true } },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    db.skillCategory.findMany({
      where: { tenantId: session.user.tenantId },
      include: { _count: { select: { skills: true } } },
      orderBy: { name: "asc" },
    }),
    db.jobTitle.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.course.findMany({
      where: { tenantId: session.user.tenantId, status: "PUBLISHED" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Skills Library" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <SkillsClient
            initialSkills={skills}
            initialCategories={categories}
            jobTitles={jobTitles}
            courses={courses}
          />
        </main>
      </div>
    </div>
  );
}
