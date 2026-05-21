import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { Sidebar, TopNav } from "@/components/layout";
import { BroadcastClient } from "./_components/broadcast-client";

function isAdmin(session: Session | null): boolean {
  return (session?.user?.roles ?? []).some((r) =>
    ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER"].includes(r)
  );
}

export const metadata = { title: "Notifications — Admin" };

export default async function AdminNotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session)) redirect("/unauthorized");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Notifications" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <BroadcastClient />
        </main>
      </div>
    </div>
  );
}
