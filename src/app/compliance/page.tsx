import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { ComplianceClient } from "./_components/compliance-client";

export const metadata = { title: "My Compliance" };

export default async function CompliancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="My Compliance" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <ComplianceClient />
        </main>
      </div>
    </div>
  );
}
