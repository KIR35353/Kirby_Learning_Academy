"use client";

import { useEffect, useState } from "react";
import { Trophy, Medal, EyeOff, Eye } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  department: string | null;
  completions: number;
  points: number;
}

export function LeaderboardClient({ currentUserId }: { currentUserId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isOptedOut, setIsOptedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  async function load() {
    const res = await fetch("/api/leaderboard?limit=20");
    const data = await res.json();
    setEntries(data.leaderboard ?? []);
    setIsOptedOut(data.isOptedOut ?? false);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleOptOut() {
    setToggling(true);
    await fetch("/api/leaderboard/opt-out", { method: "POST" });
    await load();
    setToggling(false);
  }

  const medalColors: Record<number, string> = {
    1: "text-yellow-400",
    2: "text-gray-400",
    3: "text-amber-600",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-k-navy" />
          <h2 className="text-xl font-bold text-k-navy">Top Learners</h2>
        </div>
        <button onClick={toggleOptOut} disabled={toggling}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50">
          {isOptedOut ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {isOptedOut ? "Opt back in" : "Opt out"}
        </button>
      </div>

      {isOptedOut && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You are opted out of the leaderboard. Your name will not appear to others.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          No completions yet. Be the first!
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {entries.map((entry) => {
            const isMe = entry.userId === currentUserId;
            return (
              <div key={entry.userId}
                className={`flex items-center gap-4 px-5 py-4 ${isMe ? "bg-blue-50/60" : ""}`}>
                {/* Rank */}
                <div className="w-8 text-center shrink-0">
                  {entry.rank <= 3 ? (
                    <Medal className={`h-5 w-5 mx-auto ${medalColors[entry.rank]}`} />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">{entry.rank}</span>
                  )}
                </div>

                {/* Avatar placeholder */}
                <div className="h-9 w-9 rounded-full bg-k-navy flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">
                    {entry.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </span>
                </div>

                {/* Name + dept */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isMe ? "text-k-navy" : "text-foreground"}`}>
                    {entry.name} {isMe && <span className="ml-1 text-xs text-k-navy/60">(you)</span>}
                  </p>
                  {entry.department && <p className="text-xs text-muted-foreground">{entry.department}</p>}
                </div>

                {/* Stats */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">{entry.completions} courses</p>
                  <p className="text-xs text-muted-foreground">{entry.points} pts</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
