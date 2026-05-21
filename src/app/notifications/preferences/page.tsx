import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { PreferencesClient } from "./_components/preferences-client";

export const metadata = { title: "Notification Settings" };

export default async function NotificationPreferencesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Notification Settings" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <PreferencesClient />
        </main>
      </div>
    </div>
  );
}
