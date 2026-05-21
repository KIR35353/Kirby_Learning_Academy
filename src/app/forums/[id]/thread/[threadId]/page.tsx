import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { ThreadDetailClient } from "./_components/thread-detail-client";

export const metadata = { title: "Thread" };

export default async function ThreadPage({ params }: { params: Promise<{ id: string; threadId: string }> }) {
  const { id, threadId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Forum Thread" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <ThreadDetailClient categoryId={id} threadId={threadId} currentUserId={session.user.id!} />
        </main>
      </div>
    </div>
  );
}
