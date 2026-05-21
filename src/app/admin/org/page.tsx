import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { OrgClient } from "./_components/org-client";

export const metadata = { title: "Org Structure" };

export default async function OrgPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) {
    redirect("/unauthorized");
  }

  const tenantId = (session.user as Record<string, unknown>).tenantId as string;

  const units = await db.businessUnit.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { users: true, departments: true } } },
  });

  // Dates must be serialised for client components
  const serialised = units.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Org Structure" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <OrgClient initial={serialised} />
        </main>
      </div>
    </div>
  );
}
