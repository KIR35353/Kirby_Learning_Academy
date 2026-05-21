import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { ForumsClient } from "./_components/forums-client";

export const metadata = { title: "Discussion Forums" };

export default async function ForumsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Discussion Forums" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <ForumsClient />
        </main>
      </div>
    </div>
  );
}
