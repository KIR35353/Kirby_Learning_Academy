import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { ManagerDashboardClient } from "./_components/manager-dashboard-client";

export const metadata = { title: "Team Dashboard — Manager" };

export default async function ManagerDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const departments = await db.department.findMany({
    where: { tenantId: session.user.tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Team Dashboard" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <ManagerDashboardClient departments={departments} />
        </main>
      </div>
    </div>
  );
}
