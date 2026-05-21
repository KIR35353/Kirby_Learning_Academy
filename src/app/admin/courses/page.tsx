import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { CoursesClient } from "./_components/courses-client";

export const metadata = { title: "Courses — Admin" };

export default async function AdminCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles ?? [];
  const canManage =
    roles.includes("SUPER_ADMIN") ||
    roles.includes("TENANT_ADMIN") ||
    roles.includes("INSTRUCTOR");
  if (!canManage) redirect("/unauthorized");

  const courses = await db.course.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      tags: true,
      activeVersion: { select: { versionNumber: true } },
      _count: { select: { versions: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Courses" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <p className="mb-6 text-sm text-white/50">Publish and manage CBT course bundles</p>
          <CoursesClient initialCourses={courses} />
        </main>
      </div>
    </div>
  );
}
