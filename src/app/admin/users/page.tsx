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

  const isSuperAdmin = roles.includes("SUPER_ADMIN");
  const tenantId = (session.user as Record<string, unknown>)?.tenantId as string;

  const [departments, locations, allRoles, tenants] = await Promise.all([
    db.department.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    db.location.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    db.role.findMany({ orderBy: { name: "asc" } }),
    isSuperAdmin
      ? db.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
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
            allRoles={allRoles}
            tenants={tenants}
            isSuperAdmin={isSuperAdmin}
          />
        </main>
      </div>
    </div>
  );
}
