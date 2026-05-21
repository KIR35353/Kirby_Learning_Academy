import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { Sidebar, TopNav } from "@/components/layout";
import { BadgesAdminClient } from "./_components/badges-admin-client";

function isAdmin(session: Session | null): boolean {
  return (session?.user?.roles ?? []).some((r) => ["SUPER_ADMIN", "TENANT_ADMIN"].includes(r));
}

export const metadata = { title: "Badges — Admin" };

export default async function AdminBadgesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session)) redirect("/unauthorized");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Badge Management" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <BadgesAdminClient />
        </main>
      </div>
    </div>
  );
}
