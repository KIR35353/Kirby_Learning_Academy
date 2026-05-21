"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Send, Lock } from "lucide-react";

interface Post {
  id: string;
  body: string;
  isEdited: boolean;
  createdAt: string;
  author: { id: string; name: string | null; displayName: string | null };
}

interface Thread {
  id: string;
  title: string;
  isLocked: boolean;
  isPinned: boolean;
  viewCount: number;
  postCount: number;
  author: { id: string; name: string | null; displayName: string | null };
  category: { id: string; name: string };
}

export function ThreadDetailClient({
  categoryId,
  threadId,
  currentUserId,
}: {
  categoryId: string;
  threadId: string;
  currentUserId: string;
}) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch(`/api/forums/threads/${threadId}/posts`);
    const data = await res.json();
    setThread(data.thread ?? null);
    setPosts(data.posts ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [threadId]);

  async function submitReply() {
    if (!reply.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/forums/threads/${threadId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply }),
    });
    if (res.ok) {
      setReply("");
      load();
    }
    setSubmitting(false);
  }

  function initials(user: { name: string | null; displayName: string | null }) {
    const name = user.displayName || user.name || "?";
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  }

  function displayName(user: { name: string | null; displayName: string | null }) {
    return user.displayName || user.name || "Unknown";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href={`/forums/${categoryId}`} className="text-muted-foreground hover:text-k-navy transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        {thread && (
          <div>
            <p className="text-xs text-muted-foreground">{thread.category.name}</p>
            <h2 className="text-xl font-bold text-k-navy">{thread.title}</h2>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : (
        <>
          <div className="space-y-4">
            {posts.map((post, idx) => (
              <div key={post.id} className={`flex gap-3 rounded-xl border border-border bg-card p-5 ${idx === 0 ? "border-k-navy/20 bg-blue-50/30" : ""}`}>
                <div className="h-9 w-9 rounded-full bg-k-navy flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-white">{initials(post.author)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-semibold ${post.author.id === currentUserId ? "text-k-navy" : "text-foreground"}`}>
                      {displayName(post.author)}
                      {post.author.id === currentUserId && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}
                    </span>
                    {idx === 0 && <span className="rounded-full bg-k-navy/10 px-2 py-0.5 text-[10px] font-semibold text-k-navy">OP</span>}
                    <span className="ml-auto text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleString()}</span>
                    {post.isEdited && <span className="text-xs text-muted-foreground/60 italic">edited</span>}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{post.body}</p>
                </div>
              </div>
            ))}
          </div>

          {thread?.isLocked ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" /> This thread is locked. No new replies.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <p className="text-sm font-semibold text-foreground">Add a reply</p>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                rows={4} placeholder="Write your reply…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
              <div className="flex justify-end">
                <button onClick={submitReply} disabled={submitting || !reply.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-k-navy px-4 py-2 text-sm font-medium text-white hover:bg-k-navy/80 disabled:opacity-50 transition-colors">
                  <Send className="h-4 w-4" /> {submitting ? "Posting…" : "Reply"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
