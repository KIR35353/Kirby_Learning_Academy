"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { Bell, Send, Megaphone, Loader2, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Form schema ────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, "Title required").max(200),
  body: z.string().min(1, "Message required"),
  departmentId: z.string().optional(),
  sendEmail: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

interface Department {
  id: string;
  name: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function BroadcastClient() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [result, setResult] = useState<{ sent: number; emailSent: number } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) as Resolver<FormValues> });

  useEffect(() => {
    fetch("/api/admin/departments")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((d) => setDepartments(d.data ?? []));
  }, []);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setResult(null);
    const res = await fetch("/api/admin/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const err = await res.json();
      setServerError(err?.error?.formErrors?.[0] ?? "Failed to send broadcast");
      return;
    }
    const data = await res.json();
    setResult(data);
    reset();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-k-navy" />
        <h2 className="text-xl font-bold text-k-navy">Broadcast Notification</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        Send an in-app (and optional email) notification to all or a subset of users.
      </p>

      {/* ── Form card ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-border bg-card p-6 space-y-5 shadow-sm">

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
          <Input id="title" placeholder="e.g. Company-wide training reminder" {...register("title")} />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <Label htmlFor="body">Message <span className="text-destructive">*</span></Label>
          <textarea
            id="body"
            rows={4}
            placeholder="Type your message here…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            {...register("body")}
          />
          {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
        </div>

        {/* Target audience */}
        <div className="space-y-1.5">
          <Label htmlFor="departmentId">Target audience</Label>
          <select
            id="departmentId"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register("departmentId")}
          >
            <option value="">All users (entire tenant)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Email toggle */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <input type="checkbox" id="sendEmail" {...register("sendEmail")} className="h-4 w-4 accent-k-navy" />
          <Label htmlFor="sendEmail" className="cursor-pointer font-normal">
            Also send via email
          </Label>
        </div>

        {/* Error */}
        {serverError && (
          <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">{serverError}</p>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <button type="submit" disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-k-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-k-navy/80 disabled:opacity-60 transition-colors">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isSubmitting ? "Sending…" : "Send Broadcast"}
          </button>
        </div>
      </form>

      {/* ── Success result ─────────────────────────────────────────────── */}
      {result && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">Broadcast sent!</p>
            <p className="text-sm text-green-700 mt-0.5">
              {result.sent} in-app notification{result.sent !== 1 ? "s" : ""} created
              {result.emailSent > 0 ? ` · ${result.emailSent} email${result.emailSent !== 1 ? "s" : ""} queued` : ""}.
            </p>
          </div>
        </div>
      )}

      {/* ── Info section ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Tips</span>
        </div>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Broadcast notifications appear in each user's bell icon and notifications page.</li>
          <li>Users who have opted out of in-app broadcasts will not receive them.</li>
          <li>Email delivery requires a valid <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">RESEND_API_KEY</code> in environment variables.</li>
        </ul>
      </div>
    </div>
  );
}
