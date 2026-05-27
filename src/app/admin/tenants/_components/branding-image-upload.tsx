"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type AssetType = "logo" | "favicon" | "loginBanner";

interface Props {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  tenantId: string;
  type: AssetType;
  hint?: string;
}

const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

export function BrandingImageUpload({ label, value, onChange, tenantId, type, hint }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setError(null);
    if (file.size > 2 * 1024 * 1024) {
      setError("Max 2 MB");
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      setError(type === "favicon" ? "Use PNG or ICO" : "Use PNG, JPG, GIF, WebP, SVG, or ICO");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/admin/tenants/${tenantId}/branding/upload?type=${type}`,
        { method: "POST", body: fd },
      );

      if (res.ok) {
        onChange(((await res.json()) as { url: string }).url);
        return;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const payload = (await res.json()) as { error?: string };
        setError(payload.error ?? "Upload failed");
        return;
      }

      if (res.status === 413) {
        setError("Upload rejected by proxy. Increase reverse-proxy body size (client_max_body_size) to at least 2 MB.");
        return;
      }

      setError(`Upload failed (HTTP ${res.status})`);
    } catch {
      setError("Upload failed due to a network or server error");
    } finally {
      setUploading(false);
    }
  }

  function onFiles(list: FileList | null) {
    if (list?.[0]) void uploadFile(list[0]);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium leading-none">{label}</p>

      {value ? (
        <div className="group relative flex min-h-[80px] items-center justify-center rounded-lg border border-border bg-muted/20 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="max-h-16 max-w-full object-contain" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Replace"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onChange(null)}
              disabled={uploading}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          className={`flex min-h-[80px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 transition-colors ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/20"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted-foreground" />
              <p className="text-center text-xs text-muted-foreground">
                Drop or{" "}
                <span className="font-medium text-primary">browse</span>
              </p>
              {hint && (
                <p className="text-[11px] text-muted-foreground/60">{hint}</p>
              )}
              <p className="text-[11px] text-muted-foreground/50">
                {type === "favicon"
                  ? "PNG or ICO, must be 16x16 · max 2 MB"
                  : "PNG, JPG, SVG, ICO · max 2 MB"}
              </p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={type === "favicon" ? ".png,.ico,image/png,image/x-icon,image/vnd.microsoft.icon" : "image/*,.ico"}
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}
