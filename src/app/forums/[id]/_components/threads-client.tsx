"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Plus, Pin, Lock, ChevronLeft } from "lucide-react";

interface Thread {
  id: string;
  title: string;
  isPinned: boolean;
  isLocked: boolean;
  viewCount: number;
  postCount: number;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string | null; displayName: string | null };
  category: { id: string; name: string };
  _count: { posts: number };
}

interface NewThreadForm { title: string; body: string }

export function ThreadsClient({ categoryId, currentUserId }: { categoryId: string; currentUserId: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [category, setCategory] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewThreadForm>({ title: "", body: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch(`/api/forums/threads?categoryId=${categoryId}`);
    const data = await res.json();
    setThreads(data.data ?? []);
    if (data.data?.[0]?.category) setCategory(data.data[0].category);
    setLoading(false);
  }

  useEffect(() => { load(); }, [categoryId]);

  async function submit() {
    if (!form.title.trim() || !form.body.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/forums/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, categoryId }),
    });
    if (res.ok) {
      setForm({ title: "", body: "" });
      setShowForm(false);
      load();
    }
    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/forums" className="text-muted-foreground hover:text-k-navy transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <MessageSquare className="h-5 w-5 text-k-navy" />
        <h2 className="text-xl font-bold text-k-navy">{category?.name ?? "Forum"}</h2>
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg bg-k-navy px-4 py-2 text-sm font-medium text-white hover:bg-k-navy/80 transition-colors">
          <Plus className="h-4 w-4" /> New Thread
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Thread title…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={4} placeholder="What's on your mind?"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors">Cancel</button>
            <button onClick={submit} disabled={submitting || !form.title || !form.body}
              className="px-4 py-1.5 text-sm bg-k-navy text-white rounded-lg disabled:opacity-50 hover:bg-k-navy/80 transition-colors">
              {submitting ? "Posting…" : "Post Thread"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : threads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          No threads yet. Start the conversation!
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {threads.map((t) => (
            <Link key={t.id} href={`/forums/${categoryId}/thread/${t.id}`}
              className="flex items-start gap-4 px-5 py-4 hover:bg-accent/40 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {t.isPinned && <Pin className="h-3.5 w-3.5 text-k-orange shrink-0" />}
                  {t.isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <p className="font-semibold text-foreground group-hover:text-k-navy truncate">{t.title}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  by {t.author.displayName ?? t.author.name ?? "Unknown"} · {new Date(t.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <p className="text-sm font-medium text-foreground">{t._count.posts} replies</p>
                <p className="text-xs text-muted-foreground">{t.viewCount} views</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
