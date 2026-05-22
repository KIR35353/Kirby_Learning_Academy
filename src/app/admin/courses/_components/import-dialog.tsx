"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Loader2,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileArchive,
  Pencil,
} from "lucide-react";

interface ImportResult {
  id: string;
  title: string;
  versionNumber: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

type State = "idle" | "uploading" | "success" | "error";

export function ImportDialog({ open, onClose, onImported }: Props) {
  const [file, setFile]         = useState<File | null>(null);
  const [state, setState]       = useState<State>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState<string | null>(null);
  const [result, setResult]     = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".zip")) { setFile(f); setError(null); }
    else setError("Please drop a .zip file");
  }, []);

  async function handleImport() {
    if (!file) return;
    setState("uploading");
    setError(null);
    setProgress(0);

    const form = new FormData();
    form.append("file", file);

    try {
      const imported = await new Promise<ImportResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/courses/import");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 95));
        };
        xhr.onload = () => {
          setProgress(100);
          if (xhr.status === 201) {
            const data = JSON.parse(xhr.responseText);
            resolve({
              id: data.course.id,
              title: data.course.title,
              versionNumber: data.version.versionNumber,
            });
          } else {
            try {
              reject(new Error(JSON.parse(xhr.responseText).error ?? `HTTP ${xhr.status}`));
            } catch {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(form);
      });

      setResult(imported);
      setState("success");
      onImported();
    } catch (err) {
      setState("error");
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  function handleClose() {
    if (state === "uploading") return;
    setState("idle");
    setFile(null);
    setError(null);
    setResult(null);
    setProgress(0);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="w-full max-w-md bg-[#0a1628] border-white/10 text-white">
        <SheetHeader>
          <SheetTitle className="text-white">Import Course from ZIP</SheetTitle>
          <p className="text-sm text-white/50">
            Title, description, category, objectives, and tags are read automatically
            from <code className="text-white/40">_course_manifest.json</code> inside the zip.
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {state === "success" && result ? (
            /* ── Success state ───────────────────────────────────────── */
            <div className="flex flex-col items-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <div>
                <p className="font-semibold text-emerald-300">{result.title}</p>
                <p className="mt-1 text-xs text-white/50">
                  Version {result.versionNumber} uploaded · Status: Draft
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Done
                </Button>
                <Button
                  onClick={() => { window.location.href = `/admin/courses`; }}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Details
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* ── Drop zone ─────────────────────────────────────────── */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                  dragging
                    ? "border-white/40 bg-white/10"
                    : "border-white/20 hover:border-white/30 hover:bg-white/5"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setFile(f); setError(null); }
                  }}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileArchive className="h-8 w-8 text-white/60" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">{file.name}</p>
                      <p className="text-xs text-white/40">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto mb-3 h-8 w-8 text-white/30" />
                    <p className="text-sm text-white/60">
                      Drop course <code className="text-white/40">.zip</code> here, or click to browse
                    </p>
                  </>
                )}
              </div>

              {/* ── Progress bar ──────────────────────────────────────── */}
              {state === "uploading" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>Uploading &amp; creating course…</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-white/60 transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* ── Error message ─────────────────────────────────────── */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* ── What gets auto-populated ──────────────────────────── */}
              {!file && state === "idle" && (
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/40 space-y-1">
                  <p className="font-medium text-white/60 mb-2">Auto-populated from manifest:</p>
                  <p>• Title, target audience, duration</p>
                  <p>• Learning objectives</p>
                  <p>• Description, category, tags <span className="text-white/25">(from <code>kla</code> section)</span></p>
                  <p>• Compliance tags &amp; contractor visibility</p>
                </div>
              )}

              <Button
                onClick={handleImport}
                disabled={!file || state === "uploading"}
                className="w-full bg-[#cc3d00] hover:bg-[#b33400] text-white"
              >
                {state === "uploading" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" /> Import Course</>
                )}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
