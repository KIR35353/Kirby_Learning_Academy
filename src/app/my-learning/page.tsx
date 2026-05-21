import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { MyLearningClient } from "./_components/my-learning-client";

export const metadata = { title: "My Learning — Kirby Learning Academy" };

export default async function MyLearningPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="My Learning" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <MyLearningClient />
        </main>
      </div>
    </div>
  );
}
