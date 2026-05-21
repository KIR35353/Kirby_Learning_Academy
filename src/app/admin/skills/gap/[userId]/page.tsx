import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { GapReportClient } from "./_components/gap-report-client";

export const metadata = { title: "Gap Analysis" };

export default async function GapReportPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles ?? [];
  const allowed = roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "COMPLIANCE_OFFICER", "MANAGER"].includes(r));
  if (!allowed) redirect("/unauthorized");

  const { userId } = await params;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Gap Analysis" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <GapReportClient targetUserId={userId} />
        </main>
      </div>
    </div>
  );
}
