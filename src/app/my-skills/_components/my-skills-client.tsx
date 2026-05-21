"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, TrendingUp } from "lucide-react";

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

function LevelBar({ achieved, required, max }: { achieved: number; required: number | null; max: number }) {
  const pct = max > 0 ? Math.min(100, (achieved / max) * 100) : 0;
  const reqPct = required != null && max > 0 ? (required / max) * 100 : null;
  return (
    <div className="relative h-2 w-full rounded-full bg-white/10">
      <div className="h-2 rounded-full bg-[#cc3d00] transition-all" style={{ width: `${pct}%` }} />
      {reqPct != null && (
        <div className="absolute top-0 h-2 w-0.5 bg-white/40" style={{ left: `${reqPct}%` }} />
      )}
    </div>
  );
}

export function MySkillsClient({ userId }: { userId: string }) {
  const [data, setData] = useState<GapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/skills/gap?userId=${userId}`);
      if (res.ok) setData(await res.json());
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return <div className="text-white/40 text-sm">Loading…</div>;
  if (!data) return <div className="text-white/40 text-sm">Skills not available.</div>;

  // Group by category
  const grouped = new Map<string, GapItem[]>();
  for (const item of data.matrix) {
    if (item.achievedLevel === 0 && item.requiredLevel == null) continue; // hide completely unrelated skills
    const key = item.category?.name ?? "Uncategorized";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  function levelLabel(item: GapItem, level: number) {
    if (item.levelLabels.length >= level && level > 0) return item.levelLabels[level - 1];
    return level > 0 ? `Level ${level}` : "None";
  }

  const maxLevel = 5;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">My Skills</h2>
          {data.user.jobTitle && <p className="text-sm text-white/40">{data.user.jobTitle.name}</p>}
        </div>
        <div className="flex gap-3 text-center text-sm">
          <div>
            <p className="text-white font-bold text-lg">{data.summary.met}</p>
            <p className="text-white/40 text-xs">Met</p>
          </div>
          <div>
            <p className="text-red-400 font-bold text-lg">{data.summary.gaps}</p>
            <p className="text-white/40 text-xs">Gaps</p>
          </div>
        </div>
      </div>

      {grouped.size === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-14 text-center">
          <TrendingUp className="h-8 w-8 text-white/20" />
          <p className="text-sm text-white/50">No skill data yet. Complete courses to earn skill credits.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">{cat}</p>
              <div className="space-y-3">
                {items.map((item) => {
                  const max = item.levelLabels.length || maxLevel;
                  return (
                    <div key={item.skillId} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium">{item.skillName}</span>
                        <div className="flex items-center gap-2">
                          <Badge className={`border-0 text-[10px] ${item.gap > 0 ? "bg-red-900/40 text-red-300" : item.requiredLevel != null ? "bg-emerald-900/40 text-emerald-300" : "bg-white/10 text-white/50"}`}>
                            {item.achievedLevel > 0 ? levelLabel(item, item.achievedLevel) : "None"}
                          </Badge>
                          {item.requiredLevel != null && item.gap > 0 && (
                            <Badge className="bg-red-900/30 text-red-400 border-0 text-[10px]">
                              Need: {levelLabel(item, item.requiredLevel)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <LevelBar achieved={item.achievedLevel} required={item.requiredLevel} max={max} />
                      {item.source && (
                        <p className="text-[10px] text-white/30 capitalize">Source: {item.source.replace("_", " ")}</p>
                      )}
                      {item.gap > 0 && item.recommendations.length > 0 && (
                        <div className="pt-1 space-y-1">
                          {item.recommendations.slice(0, 2).map((r) => (
                            <Link key={r.courseId} href={`/courses/${r.courseId}`}
                              className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 transition-colors">
                              <BookOpen className="h-3 w-3" />{r.title}
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
      )}

      <Link href="/catalog">
        <Button className="w-full bg-white/10 text-white hover:bg-white/20">Browse Course Catalog</Button>
      </Link>
    </div>
  );
}
