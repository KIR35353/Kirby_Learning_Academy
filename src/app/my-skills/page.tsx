import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { MySkillsClient } from "./_components/my-skills-client";

export const metadata = { title: "My Skills" };

export default async function MySkillsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="My Skills" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <MySkillsClient userId={session.user.id!} />
        </main>
      </div>
    </div>
  );
}
