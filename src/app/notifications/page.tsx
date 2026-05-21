import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { NotificationsClient } from "./_components/notifications-client";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Notifications" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <NotificationsClient />
        </main>
      </div>
    </div>
  );
}
