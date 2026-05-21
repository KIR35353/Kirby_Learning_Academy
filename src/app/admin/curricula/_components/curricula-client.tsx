"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, X, BookOpen, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Users, GraduationCap,
} from "lucide-react";

interface LearningPathSummary {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  courses: { id: string }[];
}

interface CurriculumPath {
  id: string;
  order: number;
  learningPath: LearningPathSummary;
}

interface AssignmentRow {
  id: string;
  roleName: string | null;
  departmentId: string | null;
  userId: string | null;
  dueDate: string | null;
  department?: { id: string; name: string } | null;
  user?: { id: string; name: string | null; email: string } | null;
}

interface CurriculumRow {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  paths: CurriculumPath[];
  _count: { assignments: number };
}

interface Props {
  initialCurricula: CurriculumRow[];
  availablePaths: LearningPathSummary[];
  departments: { id: string; name: string }[];
}

const ROLE_OPTIONS = ["EMPLOYEE", "CONTRACTOR", "MANAGER", "INSTRUCTOR", "COMPLIANCE_OFFICER", "TENANT_ADMIN"];

export function CurriculaClient({ initialCurricula, availablePaths, departments }: Props) {
  const [curricula, setCurricula] = useState(initialCurricula);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CurriculumRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<CurriculumRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // assignment form
  const [assignType, setAssignType] = useState<"role" | "department" | "user">("role");
  const [assignRoleName, setAssignRoleName] = useState("EMPLOYEE");
  const [assignDepartmentId, setAssignDepartmentId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  function openCreate() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setSelectedPathIds([]);
    setError(null);
    setSheetOpen(true);
  }

  function openEdit(curriculum: CurriculumRow) {
    setEditing(curriculum);
    setTitle(curriculum.title);
    setDescription(curriculum.description ?? "");
    setSelectedPathIds(curriculum.paths.map((cp) => cp.learningPath.id));
    setError(null);
    setSheetOpen(true);
  }

  function openAssign(curriculum: CurriculumRow) {
    setAssignTarget(curriculum);
    setAssignments([]);
    setAssignDueDate("");
    setAssignType("role");
    setAssignRoleName("EMPLOYEE");
    setAssignDepartmentId("");
    setAssignSheetOpen(true);
    // Load existing assignments
    fetch(`/api/admin/curricula/${curriculum.id}`)
      .then((r) => r.json())
      .then((d) => setAssignments(d.assignments ?? []));
  }

  function togglePath(pathId: string) {
    setSelectedPathIds((prev) =>
      prev.includes(pathId) ? prev.filter((id) => id !== pathId) : [...prev, pathId]
    );
  }

  function movePath(index: number, direction: -1 | 1) {
    const next = [...selectedPathIds];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setSelectedPathIds(next);
  }

  async function save() {
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const isEdit = !!editing;
      const url = isEdit ? `/api/admin/curricula/${editing!.id}` : "/api/admin/curricula";
      const method = isEdit ? "PATCH" : "POST";

      let res: Response;
      if (isEdit) {
        // First update metadata, then paths
        res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description }),
        });
        if (!res.ok) { setError("Failed to save"); return; }
        // Update paths
        res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathIds: selectedPathIds }),
        });
      } else {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, pathIds: selectedPathIds }),
        });
      }

      if (!res.ok) { setError("Failed to save"); return; }
      const saved = await res.json();
      if (isEdit) {
        setCurricula((prev) => prev.map((c) => (c.id === editing!.id ? saved : c)));
      } else {
        setCurricula((prev) => [saved, ...prev]);
      }
      setSheetOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function addAssignment() {
    if (!assignTarget) return;
    setAssigning(true);
    const assign: Record<string, string> = {};
    if (assignType === "role") assign.roleName = assignRoleName;
    if (assignType === "department") assign.departmentId = assignDepartmentId;
    if (assignDueDate) assign.dueDate = assignDueDate;

    const res = await fetch(`/api/admin/curricula/${assignTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assign }),
    });
    if (res.ok) {
      const newAssignment = await res.json();
      setAssignments((prev) => [newAssignment, ...prev]);
      setCurricula((prev) =>
        prev.map((c) =>
          c.id === assignTarget.id ? { ...c, _count: { assignments: c._count.assignments + 1 } } : c
        )
      );
    }
    setAssigning(false);
  }

  async function toggleActive(curriculum: CurriculumRow) {
    const res = await fetch(`/api/admin/curricula/${curriculum.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !curriculum.isActive }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCurricula((prev) => prev.map((c) => (c.id === curriculum.id ? updated : c)));
    }
  }

  async function deleteCurriculum(curriculum: CurriculumRow) {
    if (!confirm(`Delete "${curriculum.title}"? All assignments will be removed.`)) return;
    const res = await fetch(`/api/admin/curricula/${curriculum.id}`, { method: "DELETE" });
    if (res.ok) setCurricula((prev) => prev.filter((c) => c.id !== curriculum.id));
  }

  const pathMap = new Map(availablePaths.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Curricula</h2>
          <p className="text-sm text-white/50">{curricula.length} curriculum{curricula.length !== 1 ? "a" : ""}</p>
        </div>
        <Button onClick={openCreate} className="bg-[#cc3d00] text-white hover:bg-[#b33400]">
          <Plus className="mr-2 h-4 w-4" /> New Curriculum
        </Button>
      </div>

      {curricula.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-16 text-center">
          <GraduationCap className="h-10 w-10 text-white/20" />
          <p className="text-sm text-white/50">No curricula yet. Create one to bundle learning paths.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {curricula.map((curriculum) => {
            const isExpanded = expandedId === curriculum.id;
            const totalCourses = curriculum.paths.reduce(
              (acc, cp) => acc + (cp.learningPath.courses?.length ?? 0),
              0
            );
            return (
              <div key={curriculum.id} className="rounded-xl border border-white/10 bg-white/5">
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white truncate">{curriculum.title}</h3>
                      <Badge className={curriculum.isActive ? "bg-emerald-900/50 text-emerald-300 border-0" : "bg-white/10 text-white/40 border-0"}>
                        {curriculum.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {curriculum.description && (
                      <p className="mt-0.5 text-xs text-white/40 truncate">{curriculum.description}</p>
                    )}
                    <p className="mt-1 text-xs text-white/30">
                      {curriculum.paths.length} path{curriculum.paths.length !== 1 ? "s" : ""}
                      {totalCourses > 0 && ` · ${totalCourses} courses`}
                      {curriculum._count.assignments > 0 && ` · ${curriculum._count.assignments} assignment${curriculum._count.assignments > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : curriculum.id)}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => openAssign(curriculum)}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                      title="Manage assignments"
                    >
                      <Users className="h-4 w-4" />
                    </button>
                    <button onClick={() => toggleActive(curriculum)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors">
                      {curriculum.isActive ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEdit(curriculum)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteCurriculum(curriculum)} className="rounded-lg p-1.5 text-white/40 hover:bg-red-900/30 hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && curriculum.paths.length > 0 && (
                  <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-white/30">Learning Paths</p>
                    {curriculum.paths.map((cp, i) => (
                      <div key={cp.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
                        <span className="w-5 text-center text-xs text-white/30">{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm text-white">{cp.learningPath.title}</p>
                          <p className="text-xs text-white/30">{cp.learningPath.courses?.length ?? 0} courses</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full max-w-xl overflow-y-auto bg-[#0a1628] border-white/10 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">{editing ? "Edit Curriculum" : "New Curriculum"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-white/70">Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="e.g. New Employee Onboarding" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Description</Label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#cc3d00]"
                placeholder="Optional description…" />
            </div>

            {/* Path selector */}
            <div className="space-y-2">
              <Label className="text-white/70">Learning Paths</Label>

              {selectedPathIds.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {selectedPathIds.map((pid, i) => {
                    const path = pathMap.get(pid);
                    if (!path) return null;
                    return (
                      <div key={pid} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <span className="w-4 text-xs text-white/30">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{path.title}</p>
                          <p className="text-xs text-white/30">{path.courses.length} courses</p>
                        </div>
                        <div className="flex gap-0.5">
                          <button type="button" onClick={() => movePath(i, -1)} disabled={i === 0}
                            className="rounded p-0.5 text-white/30 hover:text-white disabled:opacity-20">
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => movePath(i, 1)} disabled={i === selectedPathIds.length - 1}
                            className="rounded p-0.5 text-white/30 hover:text-white disabled:opacity-20">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button type="button" onClick={() => togglePath(pid)} className="text-white/30 hover:text-red-400">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                {availablePaths
                  .filter((p) => !selectedPathIds.includes(p.id))
                  .map((path) => (
                    <button key={path.id} type="button" onClick={() => togglePath(path.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/10 transition-colors">
                      <Plus className="h-4 w-4 text-white/30 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{path.title}</p>
                        <p className="text-xs text-white/30">{path.courses.length} courses</p>
                      </div>
                    </button>
                  ))}
                {availablePaths.filter((p) => !selectedPathIds.includes(p.id)).length === 0 && (
                  <p className="text-xs text-white/30 text-center py-3">All active paths added</p>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button onClick={save} disabled={saving} className="flex-1 bg-[#cc3d00] text-white hover:bg-[#b33400]">
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Curriculum"}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)} className="border-white/10 text-white/70 hover:bg-white/10">
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Assign Sheet */}
      <Sheet open={assignSheetOpen} onOpenChange={setAssignSheetOpen}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto bg-[#0a1628] border-white/10 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Assign: {assignTarget?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-white/70">Assign to</Label>
              <div className="flex gap-2">
                {(["role", "department"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setAssignType(t)}
                    className={`rounded-lg px-3 py-1.5 text-sm capitalize transition-colors ${assignType === t ? "bg-[#cc3d00] text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {assignType === "role" && (
              <div className="space-y-1.5">
                <Label className="text-white/70">Role</Label>
                <select value={assignRoleName} onChange={(e) => setAssignRoleName(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm">
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            {assignType === "department" && (
              <div className="space-y-1.5">
                <Label className="text-white/70">Department</Label>
                <select value={assignDepartmentId} onChange={(e) => setAssignDepartmentId(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm">
                  <option value="">Select department…</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-white/70">Due date (optional)</Label>
              <Input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)}
                className="bg-white/5 border-white/10 text-white" />
            </div>

            <Button onClick={addAssignment} disabled={assigning} className="w-full bg-[#cc3d00] text-white hover:bg-[#b33400]">
              {assigning ? "Assigning…" : "Add Assignment"}
            </Button>

            {/* Existing assignments */}
            {assignments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-white/30">Current Assignments</p>
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <Users className="h-3.5 w-3.5 text-white/30 shrink-0" />
                    <span className="text-white/70">
                      {a.roleName ? `Role: ${a.roleName}` :
                       a.department ? `Dept: ${a.department.name}` :
                       a.user ? `User: ${a.user.name ?? a.user.email}` : "Unknown"}
                    </span>
                    {a.dueDate && <span className="ml-auto text-xs text-white/30">Due {new Date(a.dueDate).toLocaleDateString()}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
