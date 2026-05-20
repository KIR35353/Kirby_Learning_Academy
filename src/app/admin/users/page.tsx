import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { UsersTable } from "./_components/users-table";

export const metadata = { title: "User Management" };

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) {
    redirect("/unauthorized");
  }

  const tenantId = (session.user as Record<string, unknown>)?.tenantId as string;

  const [departments, locations, jobTitles, allRoles] = await Promise.all([
    db.department.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    db.location.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    db.jobTitle.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    db.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="User Management" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <UsersTable
            departments={departments}
            locations={locations}
            jobTitles={jobTitles}
            allRoles={allRoles}
          />
        </main>
      </div>
    </div>
  );
}
