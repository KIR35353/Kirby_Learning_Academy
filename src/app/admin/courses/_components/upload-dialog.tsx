"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Upload, CheckCircle2, AlertCircle, FileArchive } from "lucide-react";
import type { CourseRow } from "./types";

interface VersionResult {
  versionNumber: number;
  s3Prefix: string;
}

interface Props {
  open: boolean;
  course: CourseRow;
  onClose: () => void;
  onUploaded: (version: VersionResult) => void;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export function UploadDialog({ open, course, onClose, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VersionResult | null>(null);
  const [autoPublish, setAutoPublish] = useState(false);
  const [forceRetake, setForceRetake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".zip")) setFile(f);
    else setError("Please drop a .zip file");
  }, []);

  async function handleUpload() {
    if (!file) return;
    setState("uploading");
    setError(null);
    setProgress(0);

    const form = new FormData();
    form.append("file", file);
    if (forceRetake) form.append("forceRetake", "true");

    try {
      // Use XHR for progress
      const result = await new Promise<VersionResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/admin/courses/${course.id}/versions`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 90));
        };
        xhr.onload = () => {
          setProgress(100);
          if (xhr.status === 201) {
            const data = JSON.parse(xhr.responseText);
            resolve({ versionNumber: data.version.versionNumber, s3Prefix: data.prefix });
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

      setResult(result);
      setState("success");

      // Optionally publish immediately
      if (autoPublish) {
        await fetch(`/api/admin/courses/${course.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "PUBLISHED" }),
        });
      }

      onUploaded(result);
    } catch (err) {
      setState("error");
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  function handleClose() {
    setState("idle");
    setFile(null);
    setError(null);
    setResult(null);
    setProgress(0);
    setForceRetake(false);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="w-full max-w-md bg-[#0a1628] border-white/10 text-white">
        <SheetHeader>
          <SheetTitle className="text-white">Upload Course Content</SheetTitle>
          <p className="text-sm text-white/50">{course.title}</p>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {state === "success" ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <div>
                <p className="font-medium text-emerald-300">Upload complete!</p>
                <p className="text-sm text-white/50">
                  Version {result?.versionNumber} uploaded to S3.
                  {autoPublish ? " Course is now published." : ""}
                </p>
              </div>
              <Button onClick={handleClose} className="mt-2 bg-[#cc3d00] text-white hover:bg-[#b33400]">
                Done
              </Button>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                ref={dragRef}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  dragging
                    ? "border-[#cc3d00] bg-[#cc3d00]/10"
                    : file
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-white/20 hover:border-white/40"
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
                  <div className="flex flex-col items-center gap-2">
                    <FileArchive className="h-8 w-8 text-emerald-400" />
                    <p className="text-sm font-medium text-white">{file.name}</p>
                    <p className="text-xs text-white/40">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-white/30" />
                    <p className="text-sm text-white/60">Drop a .zip file here or click to browse</p>
                    <p className="text-xs text-white/30">Must contain CBT_Introduction.html and _course_manifest.json</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {state === "uploading" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-white/50">
                    <span>Uploading to S3…</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#cc3d00] transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  id="autopublish"
                  type="checkbox"
                  checked={autoPublish}
                  onChange={(e) => setAutoPublish(e.target.checked)}
                  className="h-4 w-4 accent-[#cc3d00]"
                />
                <label htmlFor="autopublish" className="text-sm text-white/70">
                  Publish immediately after upload
                </label>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                <input
                  id="forceretake"
                  type="checkbox"
                  checked={forceRetake}
                  onChange={(e) => setForceRetake(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#cc3d00] shrink-0"
                />
                <label htmlFor="forceretake" className="text-sm text-white/70 cursor-pointer">
                  <span className="font-medium text-amber-300">Force retake</span> — existing completions
                  will be archived and users must redo this course
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
                <Button variant="ghost" className="text-white/60" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  disabled={!file || state === "uploading"}
                  onClick={handleUpload}
                  className="bg-[#cc3d00] text-white hover:bg-[#b33400] disabled:opacity-50"
                >
                  {state === "uploading" ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" />Upload</>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
