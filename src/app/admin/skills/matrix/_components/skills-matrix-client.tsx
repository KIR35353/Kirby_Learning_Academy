"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";

interface DeptSummary { id: string; name: string }
interface JobTitleSummary { id: string; name: string }

interface SkillCell {
  skillId: string;
  achievedLevel: number;
  requiredLevel: number | null;
  gap: number;
  source: string | null;
}

interface MatrixRow {
  userId: string;
  name: string | null;
  email: string;
  department: { id: string; name: string } | null;
  jobTitle: { id: string; name: string } | null;
  cells: SkillCell[];
  gaps: number;
}

interface MatrixSkill {
  id: string;
  name: string;
  levelLabels: string[];
  category: { name: string } | null;
}

interface MatrixData {
  skills: MatrixSkill[];
  rows: MatrixRow[];
}

export function SkillsMatrixClient({
  departments, jobTitles, skillCount,
}: {
  departments: DeptSummary[];
  jobTitles: JobTitleSummary[];
  skillCount: number;
}) {
  const [departmentId, setDepartmentId] = useState("");
  const [jobTitleId, setJobTitleId] = useState("");
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [endorseSheetOpen, setEndorseSheetOpen] = useState(false);
  const [endorseTarget, setEndorseTarget] = useState<{ userId: string; userName: string; skillId: string; skillName: string; current: number } | null>(null);
  const [endorseLevel, setEndorseLevel] = useState(1);
  const [endorseNotes, setEndorseNotes] = useState("");
  const [endorsing, setEndorsing] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (departmentId) params.set("departmentId", departmentId);
    if (jobTitleId) params.set("jobTitleId", jobTitleId);
    const res = await fetch(`/api/admin/skills/matrix?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  async function endorse() {
    if (!endorseTarget) return;
    setEndorsing(true);
    await fetch("/api/admin/skills/endorse", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: endorseTarget.userId, skillId: endorseTarget.skillId, level: endorseLevel, notes: endorseNotes }),
    });
    setEndorsing(false);
    setEndorseSheetOpen(false);
    // Refresh matrix
    await load();
  }

  const filteredRows = data?.rows.filter((r) =>
    !search || (r.name ?? r.email).toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Skills Matrix</h2>
        <p className="text-sm text-white/50">{skillCount} skills in library</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-white/60 text-xs">Department</Label>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm min-w-[160px]">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-white/60 text-xs">Job title</Label>
          <select value={jobTitleId} onChange={(e) => setJobTitleId(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm min-w-[160px]">
            <option value="">All job titles</option>
            {jobTitles.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </div>
        <Button onClick={load} disabled={loading} className="bg-[#cc3d00] text-white hover:bg-[#b33400]">
          {loading ? "Loading…" : "Load Matrix"}
        </Button>
      </div>

      {data && (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employees…" className="pl-9 bg-white/5 border-white/10 text-white" />
            </div>
            <p className="text-sm text-white/40">{filteredRows.length} employee{filteredRows.length !== 1 ? "s" : ""}</p>
          </div>

          <div className="space-y-3">
            {filteredRows.length === 0 && (
              <p className="text-sm text-white/40 text-center py-10">No employees found.</p>
            )}
            {filteredRows.map((row) => {
              const gapCells = row.cells.filter((c) => c.gap > 0);
              return (
                <div key={row.userId} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-white font-medium text-sm">{row.name ?? row.email}</p>
                      <p className="text-white/40 text-xs">{row.jobTitle?.name ?? "No job title"} {row.department ? `· ${row.department.name}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.gaps > 0
                        ? <Badge className="bg-red-900/50 text-red-300 border-0 flex items-center gap-1 text-xs">
                            <AlertTriangle className="h-3 w-3" />{row.gaps} gap{row.gaps !== 1 ? "s" : ""}
                          </Badge>
                        : <Badge className="bg-emerald-900/50 text-emerald-300 border-0 flex items-center gap-1 text-xs">
                            <CheckCircle className="h-3 w-3" />All met
                          </Badge>
                      }
                      <Link href={`/admin/skills/gap/${row.userId}`}>
                        <Button variant="outline" className="border-white/10 text-white/60 hover:bg-white/10 h-7 text-xs px-2">
                          Gap Report <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {gapCells.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {gapCells.map((c) => {
                        const skill = data.skills.find((s) => s.id === c.skillId);
                        return (
                          <button key={c.skillId}
                            onClick={() => {
                              setEndorseTarget({ userId: row.userId, userName: row.name ?? row.email, skillId: c.skillId, skillName: skill?.name ?? c.skillId, current: c.achievedLevel });
                              setEndorseLevel(c.achievedLevel + 1);
                              setEndorseNotes("");
                              setEndorseSheetOpen(true);
                            }}
                            className="flex items-center gap-1.5 rounded-full bg-red-900/30 border border-red-500/20 px-2.5 py-1 text-xs text-red-300 hover:bg-red-900/50 transition-colors">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {skill?.name ?? c.skillId}
                            <span className="text-red-400/60">{c.achievedLevel}/{c.requiredLevel}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!data && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-16 text-center">
          <p className="text-sm text-white/50">Select filters and click "Load Matrix" to view skill gaps.</p>
        </div>
      )}

      {/* ── Endorse Sheet ────────────────────────────────────────────── */}
      <Sheet open={endorseSheetOpen} onOpenChange={setEndorseSheetOpen}>
        <SheetContent side="right" className="w-full max-w-sm bg-[#0a1628] border-white/10 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Endorse Skill</SheetTitle>
          </SheetHeader>
          {endorseTarget && (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-white/70">
                Manually set <span className="text-white font-medium">{endorseTarget.userName}</span>&apos;s
                level for <span className="text-white font-medium">{endorseTarget.skillName}</span>.
              </p>
              <p className="text-xs text-white/40">Current level: {endorseTarget.current}</p>
              <div className="space-y-1.5">
                <Label className="text-white/70">New level</Label>
                <Input type="number" min={1} value={endorseLevel} onChange={(e) => setEndorseLevel(parseInt(e.target.value) || 1)}
                  className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">Notes (optional)</Label>
                <textarea value={endorseNotes} onChange={(e) => setEndorseNotes(e.target.value)} rows={2}
                  className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#cc3d00]"
                  placeholder="Observed in field, certified, etc." />
              </div>
              <Button onClick={endorse} disabled={endorsing} className="w-full bg-[#cc3d00] text-white hover:bg-[#b33400]">
                {endorsing ? "Saving…" : "Endorse Skill"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
