import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { AdminReportsClient } from "./_components/admin-reports-client";

export const metadata = { title: "Reports — Admin" };

export default async function AdminReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles ?? [];
  const allowed = roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER", "MANAGER"].includes(r));
  if (!allowed) redirect("/unauthorized");

  const isSuperAdmin = roles.includes("SUPER_ADMIN");

  const [departments, courses, tenants] = await Promise.all([
    db.department.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.course.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    isSuperAdmin
      ? db.tenant.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Reports & Analytics" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <AdminReportsClient 
            departments={departments} 
            courses={courses}
            tenants={tenants}
            isSuperAdmin={isSuperAdmin}
            defaultTenantId={isSuperAdmin ? "" : session.user.tenantId}
          />
        </main>
      </div>
    </div>
  );
}
