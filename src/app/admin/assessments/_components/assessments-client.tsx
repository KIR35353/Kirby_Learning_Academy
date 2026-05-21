"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp, X, ClipboardList,
  CheckSquare, ToggleLeft, ToggleRight, Users,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

interface CourseSummary { id: string; title: string }
interface DeptSummary { id: string; name: string }

interface AssessmentRow {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  passingScore: number;
  maxAttempts: number | null;
  timeLimitMinutes: number | null;
  randomizeQuestions: boolean;
  remediationCourse: CourseSummary | null;
  _count: { questions: number; attempts: number; assignments: number };
}

type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTI_SELECT" | "ATTESTATION";

interface OptionDraft { text: string; isCorrect: boolean }
interface QuestionDraft {
  key: string; // local only
  type: QuestionType;
  text: string;
  explanation: string;
  points: number;
  tags: string;
  options: OptionDraft[];
}

const ROLE_OPTIONS = ["EMPLOYEE", "CONTRACTOR", "MANAGER", "INSTRUCTOR", "COMPLIANCE_OFFICER", "TENANT_ADMIN"];

function newQuestion(): QuestionDraft {
  return {
    key: Math.random().toString(36).slice(2),
    type: "MULTIPLE_CHOICE",
    text: "",
    explanation: "",
    points: 1,
    tags: "",
    options: [
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
  };
}

function tfQuestion(): QuestionDraft {
  return {
    key: Math.random().toString(36).slice(2),
    type: "TRUE_FALSE",
    text: "",
    explanation: "",
    points: 1,
    tags: "",
    options: [
      { text: "True", isCorrect: true },
      { text: "False", isCorrect: false },
    ],
  };
}

// ── Main component ─────────────────────────────────────────────────────────

export function AssessmentsClient({
  initialAssessments,
  availableCourses,
  departments,
}: {
  initialAssessments: AssessmentRow[];
  availableCourses: CourseSummary[];
  departments: DeptSummary[];
}) {
  const [assessments, setAssessments] = useState(initialAssessments);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AssessmentRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<AssessmentRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // meta form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"QUIZ" | "ATTESTATION">("QUIZ");
  const [passingScore, setPassingScore] = useState(80);
  const [maxAttempts, setMaxAttempts] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const [randomize, setRandomize] = useState(false);
  const [remediationCourseId, setRemediationCourseId] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // assignment form
  const [assignType, setAssignType] = useState<"role" | "department" | "user">("role");
  const [assignRole, setAssignRole] = useState("EMPLOYEE");
  const [assignDept, setAssignDept] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [assigning, setAssigning] = useState(false);

  function openCreate() {
    setEditing(null);
    setTitle(""); setDescription(""); setType("QUIZ");
    setPassingScore(80); setMaxAttempts(""); setTimeLimit("");
    setRandomize(false); setRemediationCourseId("");
    setQuestions([]);
    setError(null);
    setSheetOpen(true);
  }

  async function openEdit(a: AssessmentRow) {
    setEditing(a);
    setTitle(a.title); setDescription(a.description ?? "");
    setType(a.type as "QUIZ" | "ATTESTATION");
    setPassingScore(a.passingScore);
    setMaxAttempts(a.maxAttempts?.toString() ?? "");
    setTimeLimit(a.timeLimitMinutes?.toString() ?? "");
    setRandomize(a.randomizeQuestions);
    setRemediationCourseId(a.remediationCourse?.id ?? "");
    setError(null);

    // Fetch full questions
    const res = await fetch(`/api/admin/assessments/${a.id}`);
    const data = await res.json();
    setQuestions(
      (data.questions ?? []).map((q: { type: QuestionType; text: string; explanation: string | null; points: number; tags: string[]; options: { text: string; isCorrect: boolean }[] }) => ({
        key: Math.random().toString(36).slice(2),
        type: q.type,
        text: q.text,
        explanation: q.explanation ?? "",
        points: q.points,
        tags: q.tags.join(", "),
        options: q.options.map((o: { text: string; isCorrect: boolean }) => ({ text: o.text, isCorrect: o.isCorrect })),
      }))
    );
    setSheetOpen(true);
  }

  function addQuestion(qtype: QuestionType) {
    if (qtype === "TRUE_FALSE") setQuestions((prev) => [...prev, tfQuestion()]);
    else if (qtype === "ATTESTATION") setQuestions((prev) => [...prev, { key: Math.random().toString(36).slice(2), type: "ATTESTATION", text: "", explanation: "", points: 1, tags: "", options: [] }]);
    else setQuestions((prev) => [...prev, { ...newQuestion(), type: qtype }]);
  }

  function removeQuestion(key: string) {
    setQuestions((prev) => prev.filter((q) => q.key !== key));
  }

  function updateQuestion(key: string, field: string, value: unknown) {
    setQuestions((prev) => prev.map((q) => q.key === key ? { ...q, [field]: value } : q));
  }

  function addOption(key: string) {
    setQuestions((prev) => prev.map((q) => q.key === key ? { ...q, options: [...q.options, { text: "", isCorrect: false }] } : q));
  }

  function removeOption(key: string, idx: number) {
    setQuestions((prev) => prev.map((q) => q.key === key ? { ...q, options: q.options.filter((_, i) => i !== idx) } : q));
  }

  function updateOption(key: string, idx: number, field: "text" | "isCorrect", value: string | boolean) {
    setQuestions((prev) => prev.map((q) => {
      if (q.key !== key) return q;
      const opts = [...q.options];
      // For MC/TF, only one can be correct
      if (field === "isCorrect" && value === true && (q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE")) {
        return { ...q, options: opts.map((o, i) => ({ ...o, isCorrect: i === idx })) };
      }
      opts[idx] = { ...opts[idx], [field]: value };
      return { ...q, options: opts };
    }));
  }

  async function save() {
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true); setError(null);
    try {
      const url = editing ? `/api/admin/assessments/${editing.id}` : "/api/admin/assessments";
      const method = editing ? "PATCH" : "POST";

      // Step 1: save/create metadata
      const meta = {
        title, description, type, passingScore,
        maxAttempts: maxAttempts ? parseInt(maxAttempts) : null,
        timeLimitMinutes: timeLimit ? parseInt(timeLimit) : null,
        randomizeQuestions: randomize,
        remediationCourseId: remediationCourseId || null,
      };

      let assessmentId = editing?.id;
      if (!editing) {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meta) });
        if (!res.ok) { setError("Failed to save"); return; }
        const created = await res.json();
        assessmentId = created.id;
        setAssessments((prev) => [created, ...prev]);
      } else {
        const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meta) });
        if (!res.ok) { setError("Failed to save"); return; }
      }

      // Step 2: save questions
      if (type !== "ATTESTATION" || questions.length > 0) {
        const qPayload = {
          questions: questions.map((q, i) => ({
            type: q.type,
            text: q.text,
            explanation: q.explanation || undefined,
            points: q.points,
            order: i,
            tags: q.tags ? q.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
            options: q.options.map((o, oi) => ({ text: o.text, isCorrect: o.isCorrect, order: oi })),
          })),
        };
        const qRes = await fetch(`/api/admin/assessments/${assessmentId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(qPayload),
        });
        if (!qRes.ok) { setError("Metadata saved but questions failed"); return; }
        const updated = await qRes.json();
        setAssessments((prev) => prev.map((a) => a.id === assessmentId ? { ...a, ...updated, _count: { ...a._count, questions: questions.length } } : a));
      }

      setSheetOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(a: AssessmentRow) {
    const next = a.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    const res = await fetch(`/api/admin/assessments/${a.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }),
    });
    if (res.ok) setAssessments((prev) => prev.map((x) => x.id === a.id ? { ...x, status: next } : x));
  }

  async function deleteAssessment(a: AssessmentRow) {
    if (!confirm(`Delete "${a.title}"? All attempts will be removed.`)) return;
    const res = await fetch(`/api/admin/assessments/${a.id}`, { method: "DELETE" });
    if (res.ok) setAssessments((prev) => prev.filter((x) => x.id !== a.id));
  }

  async function addAssignment() {
    if (!assignTarget) return;
    setAssigning(true);
    const assign: Record<string, string> = {};
    if (assignType === "role") assign.roleName = assignRole;
    if (assignType === "department") assign.departmentId = assignDept;
    if (assignDue) assign.dueDate = assignDue;

    // Use admin assessment assignment endpoint
    const res = await fetch(`/api/admin/assessments/${assignTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assign }),
    });
    if (res.ok) {
      setAssessments((prev) => prev.map((a) => a.id === assignTarget.id
        ? { ...a, _count: { ...a._count, assignments: a._count.assignments + 1 } } : a));
    }
    setAssigning(false);
  }

  const STATUS_COLORS: Record<string, string> = {
    PUBLISHED: "bg-emerald-900/50 text-emerald-300 border-0",
    DRAFT: "bg-white/10 text-white/50 border-0",
    ARCHIVED: "bg-zinc-800 text-zinc-400 border-0",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Assessments</h2>
          <p className="text-sm text-white/50">{assessments.length} assessment{assessments.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate} className="bg-[#cc3d00] text-white hover:bg-[#b33400]">
          <Plus className="mr-2 h-4 w-4" /> New Assessment
        </Button>
      </div>

      {assessments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-16 text-center">
          <ClipboardList className="h-10 w-10 text-white/20" />
          <p className="text-sm text-white/50">No assessments yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/5">
              <div className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-white truncate">{a.title}</h3>
                    <Badge className={STATUS_COLORS[a.status] ?? "bg-white/10 text-white/50 border-0"}>
                      {a.status}
                    </Badge>
                    <Badge className="bg-white/10 text-white/40 border-0 text-[10px]">
                      {a.type === "ATTESTATION" ? "Attestation" : "Quiz"}
                    </Badge>
                  </div>
                  {a.description && <p className="mt-0.5 text-xs text-white/40 truncate">{a.description}</p>}
                  <p className="mt-1 text-xs text-white/30">
                    {a._count.questions} question{a._count.questions !== 1 ? "s" : ""}
                    {" · "}{a.passingScore}% to pass
                    {a.maxAttempts && ` · max ${a.maxAttempts} attempts`}
                    {a.timeLimitMinutes && ` · ${a.timeLimitMinutes}m limit`}
                    {a._count.attempts > 0 && ` · ${a._count.attempts} total attempts`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                    className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors">
                    {expandedId === a.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <button onClick={() => { setAssignTarget(a); setAssignSheetOpen(true); }}
                    className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors" title="Assign">
                    <Users className="h-4 w-4" />
                  </button>
                  <button onClick={() => toggleStatus(a)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors" title={a.status === "PUBLISHED" ? "Unpublish" : "Publish"}>
                    {a.status === "PUBLISHED" ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(a)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteAssessment(a)} className="rounded-lg p-1.5 text-white/40 hover:bg-red-900/30 hover:text-red-400 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {expandedId === a.id && (
                <div className="border-t border-white/10 px-4 pb-4 pt-3 grid grid-cols-2 gap-3 text-sm">
                  {a.remediationCourse && (
                    <p className="text-white/40">Remediation: <span className="text-white/60">{a.remediationCourse.title}</span></p>
                  )}
                  <p className="text-white/40">Assignments: <span className="text-white/60">{a._count.assignments}</span></p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Sheet ─────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full max-w-3xl overflow-y-auto bg-[#0a1628] border-white/10 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">{editing ? "Edit Assessment" : "New Assessment"}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-white/70">Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="e.g. OSHA Fall Protection Knowledge Check" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-white/70">Description</Label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                  className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#cc3d00]"
                  placeholder="Optional description…" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">Type</Label>
                <select value={type} onChange={(e) => setType(e.target.value as "QUIZ" | "ATTESTATION")}
                  className="w-full rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm">
                  <option value="QUIZ">Quiz</option>
                  <option value="ATTESTATION">Attestation</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">Passing score %</Label>
                <Input type="number" min={1} max={100} value={passingScore} onChange={(e) => setPassingScore(parseInt(e.target.value) || 80)} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">Max attempts (blank = unlimited)</Label>
                <Input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="Unlimited" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">Time limit (min, blank = none)</Label>
                <Input type="number" min={1} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="None" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-white/70">Remediation course (on fail)</Label>
                <select value={remediationCourseId} onChange={(e) => setRemediationCourseId(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm">
                  <option value="">None</option>
                  {availableCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <button type="button" onClick={() => setRandomize(!randomize)} className="text-white/60 hover:text-white">
                  {randomize ? <CheckSquare className="h-5 w-5 text-[#cc3d00]" /> : <div className="h-5 w-5 rounded border border-white/30" />}
                </button>
                <span className="text-sm text-white/70">Randomize question order</span>
              </div>
            </div>

            {/* Question builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-white/70">Questions ({questions.length})</Label>
                <div className="flex gap-1.5">
                  {(["MULTIPLE_CHOICE", "TRUE_FALSE", "MULTI_SELECT", "ATTESTATION"] as QuestionType[]).map((qt) => (
                    <button key={qt} type="button" onClick={() => addQuestion(qt)}
                      className="rounded-lg px-2 py-1 text-[10px] bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors">
                      + {qt === "MULTIPLE_CHOICE" ? "MC" : qt === "TRUE_FALSE" ? "T/F" : qt === "MULTI_SELECT" ? "Multi" : "Attest"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {questions.map((q, qi) => (
                  <QuestionEditor
                    key={q.key}
                    question={q}
                    index={qi}
                    onUpdate={(field, value) => updateQuestion(q.key, field, value)}
                    onRemove={() => removeQuestion(q.key)}
                    onAddOption={() => addOption(q.key)}
                    onRemoveOption={(idx) => removeOption(q.key, idx)}
                    onUpdateOption={(idx, field, value) => updateOption(q.key, idx, field, value)}
                  />
                ))}
                {questions.length === 0 && (
                  <p className="text-xs text-white/30 text-center py-4">No questions yet — use the buttons above to add.</p>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button onClick={save} disabled={saving} className="flex-1 bg-[#cc3d00] text-white hover:bg-[#b33400]">
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Assessment"}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)} className="border-white/10 text-white/70 hover:bg-white/10">Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Assign Sheet ────────────────────────────────────────────────── */}
      <Sheet open={assignSheetOpen} onOpenChange={setAssignSheetOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto bg-[#0a1628] border-white/10 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Assign: {assignTarget?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
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
                <select value={assignRole} onChange={(e) => setAssignRole(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm">
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
            {assignType === "department" && (
              <div className="space-y-1.5">
                <Label className="text-white/70">Department</Label>
                <select value={assignDept} onChange={(e) => setAssignDept(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-white/70">Due date (optional)</Label>
              <Input type="date" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} className="bg-white/5 border-white/10 text-white" />
            </div>
            <Button onClick={addAssignment} disabled={assigning} className="w-full bg-[#cc3d00] text-white hover:bg-[#b33400]">
              {assigning ? "Assigning…" : "Add Assignment"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Question editor sub-component ─────────────────────────────────────────

function QuestionEditor({
  question, index, onUpdate, onRemove, onAddOption, onRemoveOption, onUpdateOption,
}: {
  question: QuestionDraft;
  index: number;
  onUpdate: (field: string, value: unknown) => void;
  onRemove: () => void;
  onAddOption: () => void;
  onRemoveOption: (idx: number) => void;
  onUpdateOption: (idx: number, field: "text" | "isCorrect", value: string | boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const typeLabel: Record<QuestionType, string> = {
    MULTIPLE_CHOICE: "Multiple Choice",
    TRUE_FALSE: "True / False",
    MULTI_SELECT: "Multi-Select",
    ATTESTATION: "Attestation",
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5">
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="w-5 text-center text-xs text-white/30">{index + 1}</span>
        <span className="text-[10px] text-white/40 bg-white/10 rounded-full px-2 py-0.5">{typeLabel[question.type]}</span>
        <span className="flex-1 truncate text-sm text-white/70">{question.text || "No text yet…"}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-white/30 hover:text-red-400 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
      </div>

      {expanded && (
        <div className="border-t border-white/10 px-3 pb-3 pt-2 space-y-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-white/50">
              {question.type === "ATTESTATION" ? "Attestation statement" : "Question text"}
            </Label>
            <textarea value={question.text} onChange={(e) => onUpdate("text", e.target.value)} rows={2}
              className="w-full rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/20 px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#cc3d00]"
              placeholder={question.type === "ATTESTATION" ? "I have read and understood…" : "Enter question…"} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-white/50">Points</Label>
              <Input type="number" min={1} value={question.points} onChange={(e) => onUpdate("points", parseInt(e.target.value) || 1)}
                className="h-7 bg-white/5 border-white/10 text-white text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-white/50">Tags (comma-sep)</Label>
              <Input value={question.tags} onChange={(e) => onUpdate("tags", e.target.value)}
                className="h-7 bg-white/5 border-white/10 text-white text-xs" placeholder="OSHA, Maritime" />
            </div>
          </div>

          {question.type !== "ATTESTATION" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-white/50">
                  Answer options {question.type === "MULTI_SELECT" ? "(check all correct)" : "(check the correct one)"}
                </Label>
                {question.type !== "TRUE_FALSE" && (
                  <button type="button" onClick={onAddOption} className="text-[10px] text-white/40 hover:text-white flex items-center gap-0.5">
                    <Plus className="h-3 w-3" /> option
                  </button>
                )}
              </div>
              {question.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button type="button" onClick={() => onUpdateOption(i, "isCorrect", !opt.isCorrect)}
                    className={`shrink-0 h-4 w-4 rounded border transition-colors ${opt.isCorrect ? "bg-emerald-500 border-emerald-500" : "border-white/30 hover:border-white/60"}`}>
                    {opt.isCorrect && <span className="text-white text-[10px] flex items-center justify-center h-full">✓</span>}
                  </button>
                  <Input value={opt.text} onChange={(e) => onUpdateOption(i, "text", e.target.value)}
                    className="h-7 flex-1 bg-white/5 border-white/10 text-white text-xs" placeholder={`Option ${i + 1}…`} />
                  {question.type !== "TRUE_FALSE" && (
                    <button type="button" onClick={() => onRemoveOption(i)} className="text-white/30 hover:text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-[10px] text-white/50">Explanation (shown after answer)</Label>
            <Input value={question.explanation} onChange={(e) => onUpdate("explanation", e.target.value)}
              className="h-7 bg-white/5 border-white/10 text-white text-xs" placeholder="Optional explanation…" />
          </div>
        </div>
      )}
    </div>
  );
}
