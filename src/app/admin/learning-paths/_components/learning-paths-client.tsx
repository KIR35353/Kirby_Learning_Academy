"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, GripVertical, X, BookOpen, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from "lucide-react";

interface CourseSummary {
  id: string;
  title: string;
  category: string | null;
  duration: number | null;
  status?: string;
}

interface LearningPathCourseRow {
  id: string;
  courseId: string;
  order: number;
  isRequired: boolean;
  prerequisiteCourseId: string | null;
  course: CourseSummary;
}

interface LearningPathRow {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  courses: LearningPathCourseRow[];
  _count: { curricula: number };
}

interface Props {
  initialPaths: LearningPathRow[];
  availableCourses: CourseSummary[];
}

export function LearningPathsClient({ initialPaths, availableCourses }: Props) {
  const [paths, setPaths] = useState(initialPaths);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<LearningPathRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<
    { courseId: string; isRequired: boolean; prerequisiteCourseId: string | null }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setSelectedCourses([]);
    setError(null);
    setSheetOpen(true);
  }

  function openEdit(path: LearningPathRow) {
    setEditing(path);
    setTitle(path.title);
    setDescription(path.description ?? "");
    setSelectedCourses(
      path.courses.map((c) => ({
        courseId: c.courseId,
        isRequired: c.isRequired,
        prerequisiteCourseId: c.prerequisiteCourseId,
      }))
    );
    setError(null);
    setSheetOpen(true);
  }

  function addCourse(courseId: string) {
    if (selectedCourses.some((c) => c.courseId === courseId)) return;
    setSelectedCourses((prev) => [...prev, { courseId, isRequired: true, prerequisiteCourseId: null }]);
  }

  function removeCourse(courseId: string) {
    setSelectedCourses((prev) => prev.filter((c) => c.courseId !== courseId));
  }

  function moveCourse(index: number, direction: -1 | 1) {
    const next = [...selectedCourses];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setSelectedCourses(next);
  }

  function toggleRequired(courseId: string) {
    setSelectedCourses((prev) =>
      prev.map((c) => (c.courseId === courseId ? { ...c, isRequired: !c.isRequired } : c))
    );
  }

  async function save() {
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const url = editing ? `/api/admin/learning-paths/${editing.id}` : "/api/admin/learning-paths";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, courses: selectedCourses }),
      });
      if (!res.ok) { setError("Failed to save"); return; }
      const saved = await res.json();
      if (editing) {
        setPaths((prev) => prev.map((p) => (p.id === editing.id ? saved : p)));
      } else {
        setPaths((prev) => [saved, ...prev]);
      }
      setSheetOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(path: LearningPathRow) {
    const res = await fetch(`/api/admin/learning-paths/${path.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !path.isActive }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPaths((prev) => prev.map((p) => (p.id === path.id ? updated : p)));
    }
  }

  async function deletePath(path: LearningPathRow) {
    if (!confirm(`Delete "${path.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/learning-paths/${path.id}`, { method: "DELETE" });
    if (res.ok) {
      setPaths((prev) => prev.filter((p) => p.id !== path.id));
      return;
    }

    const data = await res.json().catch(() => ({})) as { error?: string };
    alert(data.error ?? "Failed to delete learning path");
  }

  const courseMap = new Map(availableCourses.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Learning Paths</h2>
          <p className="text-sm text-white/50">{paths.length} path{paths.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate} className="bg-[#cc3d00] text-white hover:bg-[#b33400]">
          <Plus className="mr-2 h-4 w-4" /> New Path
        </Button>
      </div>

      {paths.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-16 text-center">
          <BookOpen className="h-10 w-10 text-white/20" />
          <p className="text-sm text-white/50">No learning paths yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paths.map((path) => {
            const isExpanded = expandedId === path.id;
            return (
              <div key={path.id} className="rounded-xl border border-white/10 bg-white/5">
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white truncate">{path.title}</h3>
                      <Badge className={path.isActive ? "bg-emerald-900/50 text-emerald-300 border-0" : "bg-white/10 text-white/40 border-0"}>
                        {path.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {path.description && (
                      <p className="mt-0.5 text-xs text-white/40 truncate">{path.description}</p>
                    )}
                    <p className="mt-1 text-xs text-white/30">
                      {path.courses.length} course{path.courses.length !== 1 ? "s" : ""}
                      {path._count.curricula > 0 && ` · in ${path._count.curricula} curriculum${path._count.curricula > 1 ? "a" : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : path.id)}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => toggleActive(path)}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                      title={path.isActive ? "Deactivate" : "Activate"}
                    >
                      {path.isActive ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(path)}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deletePath(path)}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-red-900/30 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && path.courses.length > 0 && (
                  <div className="border-t border-white/10 px-4 pb-4 pt-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/30">Courses (in order)</p>
                    <div className="space-y-1.5">
                      {path.courses.map((lpc, i) => (
                        <div key={lpc.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                          <span className="w-5 text-center text-xs text-white/30">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{lpc.course.title}</p>
                            {lpc.course.category && (
                              <p className="text-xs text-white/30">{lpc.course.category}{lpc.course.duration ? ` · ${lpc.course.duration} min` : ""}</p>
                            )}
                          </div>
                          {!lpc.isRequired && (
                            <span className="text-[10px] text-white/40 bg-white/10 rounded-full px-2 py-0.5">Optional</span>
                          )}
                          {lpc.prerequisiteCourseId && (
                            <span className="text-[10px] text-amber-400 bg-amber-900/30 rounded-full px-2 py-0.5">Has prereq</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto bg-[#0a1628] border-white/10 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">{editing ? "Edit Learning Path" : "New Learning Path"}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-white/70">Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
                placeholder="e.g. Maritime Safety Fundamentals"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/70">Description</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#cc3d00]"
                placeholder="Optional description…"
              />
            </div>

            {/* Course builder */}
            <div className="space-y-2">
              <Label className="text-white/70">Courses (ordered)</Label>

              {/* Selected courses */}
              {selectedCourses.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {selectedCourses.map((sc, i) => {
                    const course = courseMap.get(sc.courseId);
                    if (!course) return null;
                    return (
                      <div key={sc.courseId} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <GripVertical className="h-4 w-4 text-white/20 shrink-0" />
                        <span className="w-4 text-xs text-white/30 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{course.title}</p>
                          {course.category && <p className="text-xs text-white/30">{course.category}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleRequired(sc.courseId)}
                          className={`text-[10px] rounded-full px-2 py-0.5 ${sc.isRequired ? "bg-blue-900/40 text-blue-300" : "bg-white/10 text-white/40"}`}
                        >
                          {sc.isRequired ? "Required" : "Optional"}
                        </button>
                        <div className="flex gap-0.5">
                          <button type="button" onClick={() => moveCourse(i, -1)} disabled={i === 0}
                            className="rounded p-0.5 text-white/30 hover:text-white disabled:opacity-20">
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => moveCourse(i, 1)} disabled={i === selectedCourses.length - 1}
                            className="rounded p-0.5 text-white/30 hover:text-white disabled:opacity-20">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button type="button" onClick={() => removeCourse(sc.courseId)}
                          className="text-white/30 hover:text-red-400 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Available courses picker */}
              <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-white/5 divide-y divide-white/5">
                {availableCourses
                  .filter((c) => !selectedCourses.some((sc) => sc.courseId === c.id))
                  .map((course) => (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => addCourse(course.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/10 transition-colors"
                    >
                      <Plus className="h-4 w-4 text-white/30 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{course.title}</p>
                        {course.category && <p className="text-xs text-white/30">{course.category}</p>}
                      </div>
                      {course.duration && <span className="ml-auto text-xs text-white/30 shrink-0">{course.duration}m</span>}
                    </button>
                  ))}
              </div>
              {availableCourses.filter((c) => !selectedCourses.some((sc) => sc.courseId === c.id)).length === 0 && (
                <p className="text-xs text-white/30 text-center py-2">All published courses added</p>
              )}
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button onClick={save} disabled={saving} className="flex-1 bg-[#cc3d00] text-white hover:bg-[#b33400]">
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Path"}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)} className="border-white/10 text-white/70 hover:bg-white/10">
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
