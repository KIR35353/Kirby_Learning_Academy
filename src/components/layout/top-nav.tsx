"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Bell, ChevronDown, LogOut, User, Settings, CheckCheck, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Types ──────────────────────────────────────────────────────────────────

interface NotifItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

// ── Props ──────────────────────────────────────────────────────────────────
type TopNavProps = {
  pageTitle?: string;
};

// ── Component ──────────────────────────────────────────────────────────────
export function TopNav({ pageTitle }: TopNavProps) {
  const { data: session } = useSession();
  const userName  = session?.user?.name  ?? session?.user?.email ?? "User";
  const userEmail = session?.user?.email ?? "";
  const userImage = (session?.user as { image?: string } | undefined)?.image ?? undefined;
  const initials  = userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications?pageSize=10");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.data ?? []);
      setUnreadCount(data.meta?.unreadCount ?? 0);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications/mark-read", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  async function markRead(id: string) {
    await fetch("/api/notifications/mark-read", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
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

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-6 shadow-sm">
      {/* page title */}
      <h1 className="truncate text-base font-semibold text-k-navy">
        {pageTitle ?? "Kirby Learning Academy"}
      </h1>

      <div className="flex items-center gap-3">
        {/* ── Notification Bell ──────────────────────────────────────── */}
        <div className="relative">
          <button
            onClick={() => { setBellOpen((o) => !o); if (!bellOpen) fetchNotifications(); }}
            className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-k-navy"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-k-orange p-0 text-[9px] text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </button>

          {/* Notification panel */}
          {bellOpen && (
            <div className="absolute right-0 top-12 z-50 w-96 rounded-xl border border-white/10 bg-[#0a1628] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="text-sm font-semibold text-white">Notifications</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} title="Mark all read"
                      className="text-xs text-white/40 hover:text-white flex items-center gap-1">
                      <CheckCheck className="h-3.5 w-3.5" /> All read
                    </button>
                  )}
                  <button onClick={() => setBellOpen(false)} className="text-white/40 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                {notifications.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-8">No notifications.</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id}
                      className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors ${!n.isRead ? "bg-white/[0.03]" : ""}`}
                      onClick={() => { if (!n.isRead) markRead(n.id); if (n.link) { setBellOpen(false); window.location.href = n.link; } }}>
                      <span className="text-lg shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? "🔔"}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${!n.isRead ? "text-white font-medium" : "text-white/70"}`}>{n.title}</p>
                        <p className="text-xs text-white/40 truncate">{n.body}</p>
                        <p className="text-[10px] text-white/25 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                      {!n.isRead && <div className="w-2 h-2 rounded-full bg-[#cc3d00] shrink-0 mt-2" />}
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-white/10 px-4 py-2 text-center">
                <Link href="/notifications" onClick={() => setBellOpen(false)}
                  className="text-xs text-white/40 hover:text-white transition-colors">
                  View all notifications
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── User Menu ──────────────────────────────────────────────── */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent">
            <Avatar className="h-7 w-7">
              {userImage && <AvatarImage src={userImage} alt={userName} />}
              <AvatarFallback className="bg-k-navy text-[11px] font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-36 truncate text-sm font-medium text-foreground sm:block">
              {userName}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            {/* User info header — plain div avoids MenuGroupContext crash */}
            <div className="px-2 py-1.5 border-b border-border mb-1">
              <p className="text-sm font-semibold truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
            <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = "/profile"}>
              <User className="mr-2 h-4 w-4" /> My Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = "/notifications/preferences"}>
              <Settings className="mr-2 h-4 w-4" /> Notification Settings
            </DropdownMenuItem>
            {/* Separator — plain div avoids MenuGroupContext crash */}
            <div className="my-1 border-t border-border" />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

