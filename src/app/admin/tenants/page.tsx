import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { TenantsTable } from "./_components/tenants-table";

export const metadata = { title: "Tenant Management" };

export default async function TenantsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  // Only SUPER_ADMIN can see the multi-tenant console
  if (!roles.includes("SUPER_ADMIN")) redirect("/unauthorized");

  const tenants = await db.tenant.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { users: true, departments: true, businessUnits: true } },
    },
  });

  const serialised = tenants.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Tenant Management" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <TenantsTable initial={serialised} />
        </main>
      </div>
    </div>
  );
}
