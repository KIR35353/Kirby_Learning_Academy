import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { LearningPathsClient } from "./_components/learning-paths-client";

export const metadata = { title: "Learning Paths — Admin" };

export default async function LearningPathsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN") || roles.includes("INSTRUCTOR");
  if (!isAdmin) redirect("/unauthorized");

  const [paths, courses] = await Promise.all([
    db.learningPath.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        courses: {
          orderBy: { order: "asc" },
          include: { course: { select: { id: true, title: true, category: true, status: true, duration: true } } },
        },
        _count: { select: { curricula: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.course.findMany({
      where: { tenantId: session.user.tenantId, status: "PUBLISHED" },
      select: { id: true, title: true, category: true, duration: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Learning Paths" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <LearningPathsClient initialPaths={paths.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))} availableCourses={courses} />
        </main>
      </div>
    </div>
  );
}
