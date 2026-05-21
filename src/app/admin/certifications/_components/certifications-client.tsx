"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Pencil, Trash2, Award, Users, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type CertFramework = "OSHA" | "USCG" | "EPA" | "ISM_CODE" | "STCW" | "DOT" | "INTERNAL";
type CertType = "INITIAL" | "RENEWAL" | "RECERTIFICATION";

interface CourseSummary { id: string; title: string }
interface UserSummary { id: string; name: string | null; email: string }

interface CertRow {
  id: string;
  name: string;
  description: string | null;
  framework: CertFramework;
  type: CertType;
  validityDays: number | null;
  renewalWindowDays: number;
  renewalCourse: CourseSummary | null;
  isActive: boolean;
  _count: { records: number; requirements: number };
}

const FRAMEWORKS: CertFramework[] = ["OSHA", "USCG", "EPA", "ISM_CODE", "STCW", "DOT", "INTERNAL"];
const FRAMEWORK_COLORS: Record<CertFramework, string> = {
  OSHA: "bg-orange-900/40 text-orange-300",
  USCG: "bg-blue-900/40 text-blue-300",
  EPA: "bg-green-900/40 text-green-300",
  ISM_CODE: "bg-purple-900/40 text-purple-300",
  STCW: "bg-cyan-900/40 text-cyan-300",
  DOT: "bg-yellow-900/40 text-yellow-300",
  INTERNAL: "bg-white/10 text-white/50",
};

// ── Component ──────────────────────────────────────────────────────────────

export function CertificationsClient({
  initialCertifications, courses, users,
}: {
  initialCertifications: CertRow[];
  courses: CourseSummary[];
  users: UserSummary[];
}) {
  const [certs, setCerts] = useState(initialCertifications);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [issueSheetOpen, setIssueSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CertRow | null>(null);
  const [issueTarget, setIssueTarget] = useState<CertRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [framework, setFramework] = useState<CertFramework>("INTERNAL");
  const [type, setType] = useState<CertType>("INITIAL");
  const [validityDays, setValidityDays] = useState("");
  const [renewalWindowDays, setRenewalWindowDays] = useState("90");
  const [renewalCourseId, setRenewalCourseId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Issue form
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [issueNotes, setIssueNotes] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueSearch, setIssueSearch] = useState("");

  function openCreate() {
    setEditing(null);
    setName(""); setDescription(""); setFramework("INTERNAL"); setType("INITIAL");
    setValidityDays(""); setRenewalWindowDays("90"); setRenewalCourseId("");
    setError(null); setSheetOpen(true);
  }

  function openEdit(c: CertRow) {
    setEditing(c);
    setName(c.name); setDescription(c.description ?? ""); setFramework(c.framework); setType(c.type);
    setValidityDays(c.validityDays?.toString() ?? ""); setRenewalWindowDays(c.renewalWindowDays.toString());
    setRenewalCourseId(c.renewalCourse?.id ?? "");
    setError(null); setSheetOpen(true);
  }

  async function save() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        name, description,
        framework, type,
        validityDays: validityDays ? parseInt(validityDays) : null,
        renewalWindowDays: parseInt(renewalWindowDays) || 90,
        renewalCourseId: renewalCourseId || null,
      };
      const url = editing ? `/api/admin/certifications/${editing.id}` : "/api/admin/certifications";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { setError("Failed to save"); return; }
      const saved: CertRow = await res.json();
      if (editing) setCerts((prev) => prev.map((c) => c.id === editing.id ? saved : c));
      else setCerts((prev) => [saved, ...prev]);
      setSheetOpen(false);
    } finally { setSaving(false); }
  }

  async function deleteCert(c: CertRow) {
    if (!confirm(`Delete "${c.name}"? All records will be removed.`)) return;
    const res = await fetch(`/api/admin/certifications/${c.id}`, { method: "DELETE" });
    if (res.ok) setCerts((prev) => prev.filter((x) => x.id !== c.id));
  }

  async function issue() {
    if (!issueTarget || selectedUserIds.length === 0) return;
    setIssuing(true);
    const res = await fetch(`/api/admin/certifications/${issueTarget.id}/issue`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: selectedUserIds, notes: issueNotes, source: "manual" }),
    });
    if (res.ok) {
      const { issued } = await res.json();
      setCerts((prev) => prev.map((c) => c.id === issueTarget.id
        ? { ...c, _count: { ...c._count, records: c._count.records + issued } } : c));
    }
    setIssuing(false);
    setIssueSheetOpen(false);
    setSelectedUserIds([]);
    setIssueNotes("");
  }

  async function toggleActive(c: CertRow) {
    const res = await fetch(`/api/admin/certifications/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    if (res.ok) setCerts((prev) => prev.map((x) => x.id === c.id ? { ...x, isActive: !c.isActive } : x));
  }

  const filteredUsers = users.filter((u) =>
    !issueSearch || (u.name ?? u.email).toLowerCase().includes(issueSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Certifications</h2>
          <p className="text-sm text-white/50">{certs.length} certification type{certs.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate} className="bg-[#cc3d00] text-white hover:bg-[#b33400]">
          <Plus className="mr-2 h-4 w-4" /> New Certification
        </Button>
      </div>

      {certs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-16 text-center">
          <Award className="h-10 w-10 text-white/20" />
          <p className="text-sm text-white/50">No certifications defined yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {certs.map((c) => (
            <div key={c.id} className={`rounded-xl border bg-white/5 ${c.isActive ? "border-white/10" : "border-white/5 opacity-60"}`}>
              <div className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-white text-sm">{c.name}</h3>
                    <Badge className={`border-0 text-[10px] ${FRAMEWORK_COLORS[c.framework]}`}>{c.framework.replace("_", " ")}</Badge>
                    <Badge className="bg-white/10 text-white/40 border-0 text-[10px]">{c.type}</Badge>
                    {!c.isActive && <Badge className="bg-white/5 text-white/30 border-0 text-[10px]">Inactive</Badge>}
                  </div>
                  {c.description && <p className="text-xs text-white/40 mt-0.5 truncate">{c.description}</p>}
                  <p className="text-[10px] text-white/30 mt-1">
                    {c.validityDays ? `Valid ${c.validityDays}d · Alert ${c.renewalWindowDays}d before` : "No expiry"}{" · "}
                    {c._count.records} record{c._count.records !== 1 ? "s" : ""}{" · "}
                    {c._count.requirements} requirement{c._count.requirements !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors">
                    {expandedId === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <button onClick={() => { setIssueTarget(c); setSelectedUserIds([]); setIssueSearch(""); setIssueSheetOpen(true); }}
                    className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors" title="Issue to users">
                    <Users className="h-4 w-4" />
                  </button>
                  <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteCert(c)} className="rounded-lg p-1.5 text-white/40 hover:bg-red-900/30 hover:text-red-400 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {expandedId === c.id && (
                <div className="border-t border-white/10 px-4 pb-4 pt-3 grid grid-cols-2 gap-3 text-sm">
                  {c.renewalCourse && <p className="text-white/40">Renewal course: <span className="text-white/60">{c.renewalCourse.title}</span></p>}
                  <div className="col-span-2 flex gap-2">
                    <Button onClick={() => toggleActive(c)} variant="outline" className="border-white/10 text-white/60 hover:bg-white/10 text-xs h-7">
                      {c.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Sheet ─────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto bg-[#0a1628] border-white/10 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">{editing ? "Edit Certification" : "New Certification"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/70">Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="e.g. OSHA 10-Hour Construction" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Description</Label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#cc3d00]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-white/70">Framework</Label>
                <select value={framework} onChange={(e) => setFramework(e.target.value as CertFramework)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm">
                  {FRAMEWORKS.map((f) => <option key={f} value={f}>{f.replace("_", " ")}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">Type</Label>
                <select value={type} onChange={(e) => setType(e.target.value as CertType)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm">
                  <option value="INITIAL">Initial</option>
                  <option value="RENEWAL">Renewal</option>
                  <option value="RECERTIFICATION">Recertification</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">Validity (days, blank = no expiry)</Label>
                <Input type="number" min={1} value={validityDays} onChange={(e) => setValidityDays(e.target.value)}
                  className="bg-white/5 border-white/10 text-white" placeholder="e.g. 1095 (3 years)" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">Alert window (days before expiry)</Label>
                <Input type="number" min={1} value={renewalWindowDays} onChange={(e) => setRenewalWindowDays(e.target.value)}
                  className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Renewal course (auto-assigned when nearing expiry)</Label>
              <select value={renewalCourseId} onChange={(e) => setRenewalCourseId(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm">
                <option value="">None</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button onClick={save} disabled={saving} className="flex-1 bg-[#cc3d00] text-white hover:bg-[#b33400]">
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Certification"}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)} className="border-white/10 text-white/70 hover:bg-white/10">Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Issue Sheet ─────────────────────────────────────────────────── */}
      <Sheet open={issueSheetOpen} onOpenChange={setIssueSheetOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto bg-[#0a1628] border-white/10 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Issue: {issueTarget?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/70">Search employees</Label>
              <Input value={issueSearch} onChange={(e) => setIssueSearch(e.target.value)}
                className="bg-white/5 border-white/10 text-white" placeholder="Filter by name…" />
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-white/10 bg-white/5 p-2">
              {filteredUsers.slice(0, 50).map((u) => (
                <label key={u.id} className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1 hover:bg-white/5">
                  <input type="checkbox" checked={selectedUserIds.includes(u.id)}
                    onChange={(e) => setSelectedUserIds((prev) => e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id))}
                    className="accent-[#cc3d00]" />
                  <span className="text-sm text-white/70">{u.name ?? u.email}</span>
                  {u.name && <span className="text-xs text-white/30">{u.email}</span>}
                </label>
              ))}
            </div>
            <p className="text-xs text-white/40">{selectedUserIds.length} selected</p>
            <div className="space-y-1.5">
              <Label className="text-white/70">Notes (optional)</Label>
              <Input value={issueNotes} onChange={(e) => setIssueNotes(e.target.value)}
                className="bg-white/5 border-white/10 text-white" placeholder="Training session, location, etc." />
            </div>
            <Button onClick={issue} disabled={issuing || selectedUserIds.length === 0}
              className="w-full bg-[#cc3d00] text-white hover:bg-[#b33400]">
              {issuing ? "Issuing…" : `Issue to ${selectedUserIds.length} employee${selectedUserIds.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
