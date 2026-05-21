import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { ThreadsClient } from "./_components/threads-client";

export const metadata = { title: "Forum" };

export default async function ForumCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Forum" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <ThreadsClient categoryId={id} currentUserId={session.user.id!} />
        </main>
      </div>
    </div>
  );
}
