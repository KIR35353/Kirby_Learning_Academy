"use client";

import { useEffect, useState } from "react";
import { CheckCheck, Bell } from "lucide-react";

interface NotifItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  COURSE_ASSIGNED: "📚",
  COURSE_DUE_SOON: "⏰",
  COURSE_OVERDUE: "🚨",
  COURSE_COMPLETED: "✅",
  CERT_EXPIRING: "⚠️",
  CERT_EXPIRED: "❌",
  CERT_ISSUED: "🏆",
  ASSESSMENT_ASSIGNED: "📝",
  BROADCAST: "📣",
  SYSTEM: "🔔",
};

export function NotificationsClient() {
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  async function load(p: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?page=${p}&pageSize=20`);
      const data = await res.json();
      setNotifications(data.data ?? []);
      setUnreadCount(data.meta?.unreadCount ?? 0);
      setPage(data.meta?.page ?? 1);
      setPages(data.meta?.pages ?? 1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); }, []);

  async function markAllRead() {
    await fetch("/api/notifications/mark-read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  async function markRead(id: string) {
    await fetch("/api/notifications/mark-read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-k-navy" />
          <h2 className="text-xl font-bold text-k-navy">All Notifications</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-k-orange px-2 py-0.5 text-xs font-bold text-white">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-lg bg-k-navy px-3 py-1.5 text-sm text-white hover:bg-k-navy/80 transition-colors">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <Bell className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-card">
          {notifications.map((n) => (
            <div key={n.id}
              className={`flex gap-4 px-5 py-4 cursor-pointer hover:bg-accent/40 transition-colors ${!n.isRead ? "bg-blue-50/50" : ""}`}
              onClick={() => { if (!n.isRead) markRead(n.id); if (n.link) window.location.href = n.link; }}>
              <span className="text-2xl shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? "🔔"}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!n.isRead ? "font-semibold text-foreground" : "text-foreground/80"}`}>{n.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.isRead && <div className="w-2.5 h-2.5 rounded-full bg-k-orange shrink-0 mt-2" />}
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => load(page - 1)} disabled={page <= 1}
            className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-accent transition-colors">
            Previous
          </button>
          <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
          <button onClick={() => load(page + 1)} disabled={page >= pages}
            className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-accent transition-colors">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
