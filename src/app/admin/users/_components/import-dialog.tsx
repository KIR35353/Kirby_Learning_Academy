"use client";

import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewRow {
  row: number;
  email: string;
  name: string;
  department: string | null;
  job_title: string | null;
  location: string | null;
  hire_date: string | null;
  is_contractor: boolean;
  is_active: boolean;
  role: string;
  action: "create" | "update";
}

interface ErrorRow { row: number; email: string; error: string }

interface PreviewResponse {
  preview: true;
  total: number;
  rows: PreviewRow[];
  errors: ErrorRow[];
}

interface ImportResponse {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: ErrorRow[];
}

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

type Stage = "idle" | "previewing" | "preview" | "importing" | "done" | "error";

export function ImportDialog({ onClose, onComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult]   = useState<ImportResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setStage("idle");
    setPreview(null);
    setResult(null);
    setErrorMsg("");
  }

  async function runPreview() {
    if (!file) return;
    setStage("previewing");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/users/import?preview=true", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data as PreviewResponse);
      setStage("preview");
    } catch (e) {
      setErrorMsg((e as Error).message);
      setStage("error");
    }
  }

  async function runImport() {
    if (!file) return;
    setStage("importing");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/users/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data as ImportResponse);
      setStage("done");
      onComplete();
    } catch (e) {
      setErrorMsg((e as Error).message);
      setStage("error");
    }
  }

  const creates = preview?.rows.filter((r) => r.action === "create").length ?? 0;
  const updates = preview?.rows.filter((r) => r.action === "update").length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Import Users from CSV</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Supports Outlook contacts export, Azure AD download, or{" "}
              <a href="/api/admin/users/import" className="text-blue-600 hover:underline" download>
                our template
              </a>
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 transition-colors
              ${file ? "border-blue-300 bg-blue-50/50" : "border-border hover:border-blue-300 hover:bg-accent/50"}`}
          >
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={pickFile} />
            {file ? (
              <>
                <FileText className="h-10 w-10 text-blue-500" />
                <span className="font-medium text-foreground">{file.name}</span>
                <span className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB — click to change</span>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <span className="font-medium text-foreground">Click to choose a CSV file</span>
                <span className="text-sm text-muted-foreground">
                  Outlook contacts export · Azure AD download · Custom CSV
                </span>
              </>
            )}
          </div>

          {/* Column guide */}
          {stage === "idle" && (
            <details className="rounded-lg border border-border text-sm">
              <summary className="cursor-pointer px-4 py-2.5 font-medium text-muted-foreground hover:text-foreground select-none">
                Supported column names (click to expand)
              </summary>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-4 pb-4 pt-2 text-xs text-muted-foreground">
                {[
                  ["Email", "email, mail, E-mail Address, userPrincipalName"],
                  ["Name", "name, displayName, or First Name + Last Name"],
                  ["Department", "department, Department"],
                  ["Job Title", "job_title, Job Title, jobTitle, title"],
                  ["Location", "location, office, officeLocation, Business City"],
                  ["Hire Date", "hire_date, Hire Date, employeeHireDate"],
                  ["Contractor?", "is_contractor, contractor, employeeType"],
                  ["Active?", "is_active, accountEnabled, active"],
                  ["Role", "role — EMPLOYEE / MANAGER / CONTRACTOR / etc."],
                ].map(([field, vals]) => (
                  <div key={field} className="flex gap-2 py-0.5">
                    <span className="font-semibold text-foreground w-24 shrink-0">{field}</span>
                    <span>{vals}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Preview table */}
          {stage === "preview" && preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-green-100 text-green-800 px-3 py-1 font-medium">
                  {creates} to create
                </span>
                <span className="rounded-full bg-blue-100 text-blue-800 px-3 py-1 font-medium">
                  {updates} to update
                </span>
                {preview.errors.length > 0 && (
                  <span className="rounded-full bg-red-100 text-red-800 px-3 py-1 font-medium">
                    {preview.errors.length} errors
                  </span>
                )}
              </div>

              {preview.rows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        {["#", "Action", "Email", "Name", "Department", "Job Title", "Location", "Role"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.rows.slice(0, 50).map((row) => (
                        <tr key={row.row} className={row.action === "create" ? "" : "bg-blue-50/40"}>
                          <td className="px-3 py-2 text-muted-foreground">{row.row}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 font-medium ${
                              row.action === "create"
                                ? "bg-green-100 text-green-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {row.action}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono">{row.email}</td>
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.department ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.job_title ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.location ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.rows.length > 50 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
                      Showing first 50 of {preview.rows.length} rows
                    </p>
                  )}
                </div>
              )}

              {preview.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
                  <p className="text-sm font-medium text-red-800">Rows with errors (will be skipped):</p>
                  {preview.errors.map((e) => (
                    <p key={e.row} className="text-xs text-red-700">
                      Row {e.row}: <span className="font-mono">{e.email}</span> — {e.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Done */}
          {stage === "done" && result && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-800">Import complete</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-green-700"><strong>{result.created}</strong> created</span>
                <span className="text-blue-700"><strong>{result.updated}</strong> updated</span>
                {result.errors > 0 && (
                  <span className="text-red-700"><strong>{result.errors}</strong> errors</span>
                )}
              </div>
              {result.errorDetails.length > 0 && (
                <div className="text-xs text-red-700 space-y-0.5">
                  {result.errorDetails.map((e) => (
                    <p key={e.row}>Row {e.row}: {e.email} — {e.error}</p>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                New users have a temporary random password. They must use "Forgot password" to set their own.
              </p>
            </div>
          )}

          {/* Error */}
          {stage === "error" && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <a
            href="/api/admin/users/import"
            download="kla-user-import-template.csv"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Download className="h-4 w-4" />
            Download template
          </a>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              {stage === "done" ? "Close" : "Cancel"}
            </Button>
            {(stage === "idle" || stage === "error") && (
              <Button
                onClick={runPreview}
                disabled={!file}
                className="bg-[#002060] text-white hover:bg-[#001245]"
              >
                Preview Import
              </Button>
            )}
            {stage === "preview" && (
              <Button
                onClick={runImport}
                disabled={!preview || (preview.rows.length === 0)}
                className="bg-[#002060] text-white hover:bg-[#001245]"
              >
                Import {preview?.rows.length ?? 0} Users
              </Button>
            )}
            {(stage === "previewing" || stage === "importing") && (
              <Button disabled className="bg-[#002060] text-white opacity-70">
                {stage === "previewing" ? "Previewing…" : "Importing…"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
