"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, BookOpen, ArrowLeft } from "lucide-react";

interface GapItem {
  skillId: string;
  skillName: string;
  category: { id: string; name: string } | null;
  levelLabels: string[];
  achievedLevel: number;
  requiredLevel: number | null;
  gap: number;
  source: string | null;
  grantedAt: string | null;
  recommendations: { courseId: string; title: string; levelGrant: number }[];
}

interface GapData {
  user: { id: string; name: string | null; email: string; jobTitle: { id: string; name: string } | null };
  matrix: GapItem[];
  summary: { total: number; met: number; gaps: number; unassessed: number };
}

export function GapReportClient({ targetUserId }: { targetUserId: string }) {
  const [data, setData] = useState<GapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "gaps" | "met">("all");

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/skills/gap?userId=${targetUserId}`);
      if (res.ok) setData(await res.json());
      setLoading(false);
    })();
  }, [targetUserId]);

  if (loading) return <div className="text-white/40 text-sm">Loading…</div>;
  if (!data) return <div className="text-white/40 text-sm">User not found.</div>;

  const filtered = data.matrix.filter((m) => {
    if (filter === "gaps") return m.gap > 0;
    if (filter === "met") return m.requiredLevel != null && m.achievedLevel >= (m.requiredLevel ?? 0);
    return true;
  });

  // Group by category
  const grouped = new Map<string, GapItem[]>();
  for (const item of filtered) {
    const key = item.category?.name ?? "Uncategorized";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  function levelLabel(item: GapItem, level: number) {
    if (item.levelLabels.length >= level && level > 0) return item.levelLabels[level - 1];
    return `Level ${level}`;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/skills/matrix">
          <button className="text-white/40 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-white">{data.user.name ?? data.user.email}</h2>
          <p className="text-sm text-white/40">{data.user.jobTitle?.name ?? "No job title"}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total skills", value: data.summary.total, cls: "bg-white/5" },
          { label: "Requirements met", value: data.summary.met, cls: "bg-emerald-900/20 text-emerald-300" },
          { label: "Gaps", value: data.summary.gaps, cls: "bg-red-900/20 text-red-300" },
          { label: "No requirement", value: data.summary.unassessed, cls: "bg-white/5 text-white/50" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border border-white/10 p-4 ${s.cls}`}>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-white/50 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {(["all", "gaps", "met"] as const).map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${filter === t ? "border-[#cc3d00] text-white" : "border-transparent text-white/40 hover:text-white/70"}`}>
            {t === "all" ? `All (${data.matrix.length})` : t === "gaps" ? `Gaps (${data.summary.gaps})` : `Met (${data.summary.met})`}
          </button>
        ))}
      </div>

      {/* Matrix */}
      <div className="space-y-6">
        {[...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
          <div key={cat}>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">{cat}</p>
            <div className="space-y-2">
              {items.map((item) => {
                const hasGap = item.gap > 0;
                const isMet = item.requiredLevel != null && item.achievedLevel >= (item.requiredLevel ?? 0);
                return (
                  <div key={item.skillId} className={`rounded-xl border p-4 space-y-2 ${hasGap ? "border-red-500/20 bg-red-900/10" : isMet ? "border-emerald-500/20 bg-emerald-900/10" : "border-white/10 bg-white/5"}`}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        {hasGap
                          ? <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                          : isMet
                          ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                          : <div className="h-4 w-4 rounded-full border border-white/20 shrink-0" />}
                        <span className="text-white text-sm font-medium">{item.skillName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge className={`border-0 text-[10px] ${item.achievedLevel > 0 ? "bg-white/10 text-white/60" : "bg-white/5 text-white/30"}`}>
                          Have: {item.achievedLevel > 0 ? levelLabel(item, item.achievedLevel) : "None"}
                        </Badge>
                        {item.requiredLevel != null && (
                          <Badge className={`border-0 text-[10px] ${hasGap ? "bg-red-900/40 text-red-300" : "bg-emerald-900/40 text-emerald-300"}`}>
                            Need: {levelLabel(item, item.requiredLevel)}
                          </Badge>
                        )}
                        {item.source && <span className="text-white/30">{item.source}</span>}
                      </div>
                    </div>

                    {hasGap && item.recommendations.length > 0 && (
                      <div className="pl-6 space-y-1">
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">Recommended courses</p>
                        {item.recommendations.map((r) => (
                          <Link key={r.courseId} href={`/courses/${r.courseId}`}
                            className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 transition-colors">
                            <BookOpen className="h-3 w-3" />{r.title}
                            <span className="text-blue-300/50">→ Level {r.levelGrant}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-white/40 py-10">No skills match this filter.</p>
      )}
    </div>
  );
}
