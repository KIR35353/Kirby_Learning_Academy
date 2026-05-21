import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { SkillsMatrixClient } from "./_components/skills-matrix-client";

export const metadata = { title: "Skills Matrix — Admin" };

export default async function SkillsMatrixPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles ?? [];
  const allowed = roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "COMPLIANCE_OFFICER", "MANAGER"].includes(r));
  if (!allowed) redirect("/unauthorized");

  const [departments, jobTitles, skills] = await Promise.all([
    db.department.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.jobTitle.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.skill.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, name: true, levelLabels: true, category: { select: { name: true } } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Skills Matrix" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <SkillsMatrixClient departments={departments} jobTitles={jobTitles} skillCount={skills.length} />
        </main>
      </div>
    </div>
  );
}
