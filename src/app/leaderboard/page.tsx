import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { LeaderboardClient } from "./_components/leaderboard-client";

export const metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Leaderboard" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <LeaderboardClient currentUserId={session.user.id!} />
        </main>
      </div>
    </div>
  );
}
