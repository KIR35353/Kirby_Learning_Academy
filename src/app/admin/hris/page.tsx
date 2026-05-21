import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { HrisPanel } from "./_components/hris-panel";

export const metadata = { title: "HRIS Sync" };

export default async function HrisPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) {
    redirect("/unauthorized");
  }

  const tenantId = (session.user as Record<string, unknown>).tenantId as string;

  const logs = await db.hrisSyncLog.findMany({
    where: { tenantId },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  const serialised = logs.map((l) => ({
    ...l,
    errors: l.errors as string[] | null,
    startedAt: l.startedAt.toISOString(),
    finishedAt: l.finishedAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="HRIS Sync" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <HrisPanel initial={serialised} />
        </main>
      </div>
    </div>
  );
}
