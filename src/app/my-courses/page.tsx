import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { MyCoursesClient } from "./_components/my-courses-client";

export const metadata = { title: "My Courses — Kirby Learning Academy" };

export default async function MyCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const enrollments = await db.enrollment.findMany({
    where: { userId: session.user.id, tenantId: session.user.tenantId },
    include: {
      course: {
        include: {
          tags: true,
          activeVersion: { select: { versionNumber: true } },
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="My Courses" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <MyCoursesClient initialEnrollments={enrollments} />
        </main>
      </div>
    </div>
  );
}
