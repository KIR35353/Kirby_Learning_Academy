import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { AchievementsClient } from "./_components/achievements-client";

export const metadata = { title: "My Achievements" };

export default async function AchievementsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="My Achievements" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <AchievementsClient />
        </main>
      </div>
    </div>
  );
}
