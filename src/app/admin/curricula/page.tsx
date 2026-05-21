import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { CurriculaClient } from "./_components/curricula-client";

export const metadata = { title: "Curricula — Admin" };

export default async function CurriculaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN") || roles.includes("INSTRUCTOR");
  if (!isAdmin) redirect("/unauthorized");

  const [curricula, learningPaths, departments] = await Promise.all([
    db.curriculum.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        paths: {
          orderBy: { order: "asc" },
          include: {
            learningPath: {
              include: { courses: { select: { id: true } } },
            },
          },
        },
        _count: { select: { assignments: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.learningPath.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      include: { courses: { select: { id: true } } },
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
        <TopNav pageTitle="Curricula" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <CurriculaClient
            initialCurricula={curricula}
            availablePaths={learningPaths}
            departments={departments}
          />
        </main>
      </div>
    </div>
  );
}
