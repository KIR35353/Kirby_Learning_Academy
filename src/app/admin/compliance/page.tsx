import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { ComplianceDashboardClient } from "./_components/compliance-dashboard-client";

export const metadata = { title: "Compliance Dashboard — Admin" };

export default async function CompliancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles ?? [];
  const allowed = roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER", "MANAGER"].includes(r));
  if (!allowed) redirect("/unauthorized");

  const [departments] = await Promise.all([
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
        <TopNav pageTitle="Compliance Dashboard" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <ComplianceDashboardClient departments={departments} />
        </main>
      </div>
    </div>
  );
}
