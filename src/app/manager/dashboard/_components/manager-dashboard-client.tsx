"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Dept { id: string; name: string }

interface TeamMember {
  id: string; name: string | null; email: string;
  department: string | null; jobTitle: string | null;
  enrollments: { total: number; completed: number; overdue: number; completionRate: number };
  certs: { expiring: number; expired: number; total: number };
}

export function ManagerDashboardClient({ departments }: { departments: Dept[] }) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptId, setDeptId] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "overdue" | "rate">("overdue");

  const load = useCallback(async () => {
    setLoading(true);
    const params = deptId ? `?departmentId=${deptId}` : "";
    const res = await fetch(`/api/reports/team${params}`);
    if (res.ok) setTeam(await res.json());
    setLoading(false);
  }, [deptId]);

  useEffect(() => { load(); }, [load]);

  const sorted = [...team].sort((a, b) => {
    if (sortBy === "overdue") return b.enrollments.overdue - a.enrollments.overdue;
    if (sortBy === "rate") return a.enrollments.completionRate - b.enrollments.completionRate;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  const totalOverdue = team.reduce((s, m) => s + m.enrollments.overdue, 0);
  const totalExpiring = team.reduce((s, m) => s + m.certs.expiring, 0);
  const avgRate = team.length > 0
    ? Math.round(team.reduce((s, m) => s + m.enrollments.completionRate, 0) / team.length)
    : 0;

  // Chart data: completion rate per person (top 10)
  const chartData = sorted.slice(0, 10).map((m) => ({
    name: (m.name ?? m.email).split(" ")[0],
    rate: m.enrollments.completionRate,
    overdue: m.enrollments.overdue,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Team Dashboard</h2>
          <p className="text-sm text-white/50">{team.length} employees</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={deptId} onChange={(e) => setDeptId(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 text-white/70 px-3 py-1.5 text-sm">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Button onClick={load} variant="outline" className="border-white/10 text-white/60 hover:bg-white/10 h-8 px-3">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
          <div>
            <p className="text-xs text-white/50">Avg Completion Rate</p>
            <p className="text-2xl font-semibold text-white">{avgRate}%</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <p className="text-xs text-white/50">Overdue Assignments</p>
            <p className="text-2xl font-semibold text-white">{totalOverdue}</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-yellow-400 shrink-0" />
          <div>
            <p className="text-xs text-white/50">Expiring Certs</p>
            <p className="text-2xl font-semibold text-white">{totalExpiring}</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      {!loading && chartData.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-medium text-white/70 mb-4">Completion Rate by Employee (Top 10)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
              <Bar dataKey="rate" name="Completion %" fill="#cc3d00" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Team table */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-medium text-white/70">Team Members</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Sort:</span>
            {(["name", "overdue", "rate"] as const).map((s) => (
              <button key={s} onClick={() => setSortBy(s)}
                className={`text-xs px-2 py-1 rounded ${sortBy === s ? "bg-[#cc3d00]/20 text-[#cc3d00]" : "text-white/40 hover:text-white/70"}`}>
                {s === "rate" ? "Completion" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg bg-white/5" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/40">
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Dept / Role</th>
                <th className="px-4 py-3 text-right">Completion</th>
                <th className="px-4 py-3 text-right">Overdue</th>
                <th className="px-4 py-3 text-right">Cert Issues</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sorted.map((m) => (
                <tr key={m.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <p className="text-white/80">{m.name ?? "—"}</p>
                    <p className="text-white/30 text-xs">{m.email}</p>
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">
                    {m.department ?? "—"}{m.jobTitle ? ` · ${m.jobTitle}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge className={`border-0 text-xs ${m.enrollments.completionRate >= 80 ? "bg-green-900/40 text-green-300" : m.enrollments.completionRate >= 50 ? "bg-yellow-900/40 text-yellow-300" : "bg-red-900/40 text-red-300"}`}>
                      {m.enrollments.completionRate}%
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.enrollments.overdue > 0
                      ? <Badge className="bg-red-900/40 text-red-300 border-0 text-xs">{m.enrollments.overdue}</Badge>
                      : <span className="text-white/20">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.certs.expiring + m.certs.expired > 0
                      ? <Badge className="bg-yellow-900/40 text-yellow-300 border-0 text-xs">{m.certs.expiring + m.certs.expired}</Badge>
                      : <span className="text-white/20">—</span>}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-white/30">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
