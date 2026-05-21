"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Pencil, Trash2, Layers, BookOpen, Briefcase, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface CategorySummary { id: string; name: string; _count: { skills: number } }
interface CourseSummary { id: string; title: string }
interface JobTitleSummary { id: string; name: string }

interface CourseSkillRow { courseId: string; levelGrant: number; course: CourseSummary }
interface RoleReqRow { jobTitleId: string; requiredLevel: number; jobTitle: JobTitleSummary }

interface SkillRow {
  id: string;
  name: string;
  description: string | null;
  levelLabels: string[];
  category: CategorySummary | null;
  courseSkills: CourseSkillRow[];
  roleRequirements: RoleReqRow[];
  _count: { userSkills: number };
}

const DEFAULT_LEVELS = ["Awareness", "Developing", "Proficient", "Advanced", "Expert"];

// ── Component ──────────────────────────────────────────────────────────────

export function SkillsClient({
  initialSkills, initialCategories, jobTitles, courses,
}: {
  initialSkills: SkillRow[];
  initialCategories: CategorySummary[];
  jobTitles: JobTitleSummary[];
  courses: CourseSummary[];
}) {
  const [skills, setSkills] = useState(initialSkills);
  const [categories, setCategories] = useState(initialCategories);
  const [activeTab, setActiveTab] = useState<"skills" | "categories">("skills");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<SkillRow | null>(null);
  const [catSheetOpen, setCatSheetOpen] = useState(false);

  // Skill form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [levelLabels, setLevelLabels] = useState(DEFAULT_LEVELS.join(", "));
  const [courseSkills, setCourseSkills] = useState<{ courseId: string; levelGrant: number }[]>([]);
  const [roleReqs, setRoleReqs] = useState<{ jobTitleId: string; requiredLevel: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category form
  const [catName, setCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  function levelCount() {
    return levelLabels.split(",").map((l) => l.trim()).filter(Boolean).length || 5;
  }

  function openCreate() {
    setEditing(null);
    setName(""); setDescription(""); setCategoryId("");
    setLevelLabels(DEFAULT_LEVELS.join(", "));
    setCourseSkills([]); setRoleReqs([]);
    setError(null); setSheetOpen(true);
  }

  function openEdit(s: SkillRow) {
    setEditing(s);
    setName(s.name); setDescription(s.description ?? "");
    setCategoryId(s.category?.id ?? "");
    setLevelLabels(s.levelLabels.length > 0 ? s.levelLabels.join(", ") : DEFAULT_LEVELS.join(", "));
    setCourseSkills(s.courseSkills.map((c) => ({ courseId: c.courseId, levelGrant: c.levelGrant })));
    setRoleReqs(s.roleRequirements.map((r) => ({ jobTitleId: r.jobTitleId, requiredLevel: r.requiredLevel })));
    setError(null); setSheetOpen(true);
  }

  async function save() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError(null);
    try {
      const parsedLabels = levelLabels.split(",").map((l) => l.trim()).filter(Boolean);

      let skillId: string;
      if (editing) {
        const res = await fetch(`/api/admin/skills/${editing.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, categoryId: categoryId || null, levelLabels: parsedLabels }),
        });
        if (!res.ok) { setError("Failed to save"); return; }
        skillId = editing.id;
      } else {
        const res = await fetch("/api/admin/skills", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, categoryId: categoryId || null, levelLabels: parsedLabels }),
        });
        if (!res.ok) { setError("Failed to create"); return; }
        const created: SkillRow = await res.json();
        skillId = created.id;
        setSkills((prev) => [...prev, created]);
      }

      // Save course mappings
      await fetch(`/api/admin/skills/${skillId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSkills }),
      });

      // Save role requirements
      await fetch(`/api/admin/skills/${skillId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleRequirements: roleReqs }),
      });

      // Refresh skill in list
      const fresh = await fetch(`/api/admin/skills/${skillId}`).then((r) => r.json());
      setSkills((prev) => prev.map((s) => s.id === skillId ? fresh : s));
      if (!editing) setSkills((prev) => [...prev.filter((s) => s.id !== skillId), fresh]);

      setSheetOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSkill(s: SkillRow) {
    if (!confirm(`Delete skill "${s.name}"?`)) return;
    const res = await fetch(`/api/admin/skills/${s.id}`, { method: "DELETE" });
    if (res.ok) setSkills((prev) => prev.filter((x) => x.id !== s.id));
  }

  async function createCategory() {
    if (!catName.trim()) return;
    setCatSaving(true);
    const res = await fetch("/api/admin/skills", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", name: catName }),
    });
    if (res.ok) {
      const cat: CategorySummary = { ...(await res.json()), _count: { skills: 0 } };
      setCategories((prev) => [...prev, cat]);
      setCatName("");
    }
    setCatSaving(false);
  }

  async function deleteCategory(cat: CategorySummary) {
    if (!confirm(`Delete category "${cat.name}"? Skills in this category will be uncategorized.`)) return;
    // No dedicated delete endpoint for category — use skills API convention
    // For now just remove locally (server-side cascade handles skills.categoryId → null)
    await fetch(`/api/admin/skills?categoryId=${cat.id}`, { method: "DELETE" }).catch(() => null);
    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
  }

  // Group skills by category
  const grouped = new Map<string, { cat: CategorySummary | null; items: SkillRow[] }>();
  for (const s of skills) {
    const key = s.category?.id ?? "__none__";
    if (!grouped.has(key)) grouped.set(key, { cat: s.category, items: [] });
    grouped.get(key)!.items.push(s);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Skills Library</h2>
          <p className="text-sm text-white/50">{skills.length} skill{skills.length !== 1 ? "s" : ""} · {categories.length} categories</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCatSheetOpen(true)} variant="outline" className="border-white/10 text-white/70 hover:bg-white/10">
            <Layers className="mr-2 h-4 w-4" /> Categories
          </Button>
          <Button onClick={openCreate} className="bg-[#cc3d00] text-white hover:bg-[#b33400]">
            <Plus className="mr-2 h-4 w-4" /> New Skill
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-0">
        {(["skills", "categories"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${activeTab === t ? "border-[#cc3d00] text-white" : "border-transparent text-white/40 hover:text-white/70"}`}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === "skills" && (
        <div className="space-y-6">
          {[...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, { cat, items }]) => (
            <div key={key}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                {cat?.name ?? "Uncategorized"}
              </p>
              <div className="space-y-2">
                {items.map((s) => (
                  <div key={s.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm">{s.name}</span>
                        <Badge className="bg-white/10 text-white/40 border-0 text-[10px]">
                          {(s.levelLabels.length > 0 ? s.levelLabels.length : 5)} levels
                        </Badge>
                        {s.courseSkills.length > 0 && (
                          <Badge className="bg-blue-900/40 text-blue-300 border-0 text-[10px] flex items-center gap-0.5">
                            <BookOpen className="h-2.5 w-2.5" />{s.courseSkills.length} course{s.courseSkills.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        {s.roleRequirements.length > 0 && (
                          <Badge className="bg-purple-900/40 text-purple-300 border-0 text-[10px] flex items-center gap-0.5">
                            <Briefcase className="h-2.5 w-2.5" />{s.roleRequirements.length} role{s.roleRequirements.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      {s.description && <p className="text-xs text-white/40 mt-0.5 truncate">{s.description}</p>}
                      <p className="text-[10px] text-white/30 mt-0.5">{s._count.userSkills} user{s._count.userSkills !== 1 ? "s" : ""} have this skill</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteSkill(s)} className="rounded-lg p-1.5 text-white/40 hover:bg-red-900/30 hover:text-red-400 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {skills.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-14 text-center">
              <Layers className="h-8 w-8 text-white/20" />
              <p className="text-sm text-white/50">No skills yet. Create one to get started.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "categories" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={catName} onChange={(e) => setCatName(e.target.value)}
              placeholder="New category name…" className="bg-white/5 border-white/10 text-white max-w-xs" />
            <Button onClick={createCategory} disabled={catSaving || !catName.trim()} className="bg-[#cc3d00] text-white hover:bg-[#b33400]">
              {catSaving ? "Adding…" : "Add Category"}
            </Button>
          </div>
          {categories.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">{c.name}</p>
                <p className="text-white/40 text-xs">{c._count.skills} skill{c._count.skills !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => deleteCategory(c)} className="text-white/30 hover:text-red-400 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Skill Sheet ──────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full max-w-xl overflow-y-auto bg-[#0a1628] border-white/10 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">{editing ? "Edit Skill" : "New Skill"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-white/70">Skill name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="e.g. OSHA Hazard Recognition" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Description</Label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#cc3d00]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Category</Label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm">
                <option value="">Uncategorized</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Proficiency level labels (comma-separated, lowest → highest)</Label>
              <Input value={levelLabels} onChange={(e) => setLevelLabels(e.target.value)}
                className="bg-white/5 border-white/10 text-white text-xs" placeholder="Awareness, Developing, Proficient, Advanced, Expert" />
              <p className="text-[10px] text-white/30">{levelCount()} levels defined</p>
            </div>

            {/* Course mappings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white/70">Grant on course completion</Label>
                <button type="button" onClick={() => setCourseSkills((prev) => [...prev, { courseId: "", levelGrant: 1 }])}
                  className="text-xs text-white/40 hover:text-white flex items-center gap-1">
                  <Plus className="h-3 w-3" /> add
                </button>
              </div>
              {courseSkills.map((cs, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={cs.courseId} onChange={(e) => setCourseSkills((prev) => prev.map((x, xi) => xi === i ? { ...x, courseId: e.target.value } : x))}
                    className="flex-1 rounded-lg bg-white/5 border border-white/10 text-white px-2 py-1.5 text-xs">
                    <option value="">Select course…</option>
                    {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/40">Level</span>
                    <Input type="number" min={1} max={levelCount()} value={cs.levelGrant}
                      onChange={(e) => setCourseSkills((prev) => prev.map((x, xi) => xi === i ? { ...x, levelGrant: parseInt(e.target.value) || 1 } : x))}
                      className="w-14 h-7 bg-white/5 border-white/10 text-white text-xs" />
                  </div>
                  <button type="button" onClick={() => setCourseSkills((prev) => prev.filter((_, xi) => xi !== i))} className="text-white/30 hover:text-red-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Role requirements */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white/70">Required by job title</Label>
                <button type="button" onClick={() => setRoleReqs((prev) => [...prev, { jobTitleId: "", requiredLevel: 1 }])}
                  className="text-xs text-white/40 hover:text-white flex items-center gap-1">
                  <Plus className="h-3 w-3" /> add
                </button>
              </div>
              {roleReqs.map((rr, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={rr.jobTitleId} onChange={(e) => setRoleReqs((prev) => prev.map((x, xi) => xi === i ? { ...x, jobTitleId: e.target.value } : x))}
                    className="flex-1 rounded-lg bg-white/5 border border-white/10 text-white px-2 py-1.5 text-xs">
                    <option value="">Select job title…</option>
                    {jobTitles.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/40">Level</span>
                    <Input type="number" min={1} max={levelCount()} value={rr.requiredLevel}
                      onChange={(e) => setRoleReqs((prev) => prev.map((x, xi) => xi === i ? { ...x, requiredLevel: parseInt(e.target.value) || 1 } : x))}
                      className="w-14 h-7 bg-white/5 border-white/10 text-white text-xs" />
                  </div>
                  <button type="button" onClick={() => setRoleReqs((prev) => prev.filter((_, xi) => xi !== i))} className="text-white/30 hover:text-red-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button onClick={save} disabled={saving} className="flex-1 bg-[#cc3d00] text-white hover:bg-[#b33400]">
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Skill"}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)} className="border-white/10 text-white/70 hover:bg-white/10">Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Category quick-add Sheet ─────────────────────────────────── */}
      <Sheet open={catSheetOpen} onOpenChange={setCatSheetOpen}>
        <SheetContent side="right" className="w-full max-w-sm bg-[#0a1628] border-white/10 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Manage Categories</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="flex gap-2">
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="New category…"
                className="bg-white/5 border-white/10 text-white flex-1" />
              <Button onClick={createCategory} disabled={catSaving || !catName.trim()} className="bg-[#cc3d00] text-white hover:bg-[#b33400]">Add</Button>
            </div>
            <div className="space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                  <span className="text-sm text-white">{c.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/40">{c._count.skills}</span>
                    <button onClick={() => deleteCategory(c)} className="text-white/30 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
