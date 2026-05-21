"use client";

import { useEffect, useState } from "react";
import { Settings, Loader2 } from "lucide-react";

interface PrefItem {
  type: string;
  inApp: boolean;
  email: boolean;
}

const LABELS: Record<string, string> = {
  COURSE_ASSIGNED: "Course Assigned",
  COURSE_DUE_SOON: "Course Due Soon",
  COURSE_OVERDUE: "Course Overdue",
  COURSE_COMPLETED: "Course Completed",
  CERT_EXPIRING: "Certificate Expiring",
  CERT_EXPIRED: "Certificate Expired",
  CERT_ISSUED: "Certificate Issued",
  ASSESSMENT_ASSIGNED: "Assessment Assigned",
  ASSESSMENT_DUE: "Assessment Due",
  BROADCAST: "Broadcast Messages",
  SYSTEM: "System Alerts",
};

export function PreferencesClient() {
  const [prefs, setPrefs] = useState<PrefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((r) => r.json())
      .then((data) => setPrefs(data))
      .finally(() => setLoading(false));
  }, []);

  function toggle(type: string, field: "inApp" | "email") {
    setPrefs((prev) =>
      prev.map((p) => p.type === type ? { ...p, [field]: !p[field] } : p)
    );
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading preferences...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-k-navy" />
        <h2 className="text-xl font-bold text-k-navy">Notification Preferences</h2>
      </div>
      <p className="text-sm text-muted-foreground">Choose how you want to be notified for each event type.</p>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_80px] gap-4 px-5 py-3 border-b border-border bg-muted/40">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Event</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">In-App</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Email</span>
        </div>

        {prefs.map((pref) => (
          <div key={pref.type} className="grid grid-cols-[1fr_80px_80px] gap-4 items-center px-5 py-3.5 border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
            <span className="text-sm font-medium text-foreground">{LABELS[pref.type] ?? pref.type}</span>
            <div className="flex justify-center">
              <button
                onClick={() => toggle(pref.type, "inApp")}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pref.inApp ? "bg-k-navy" : "bg-gray-200"}`}
                aria-label={`Toggle in-app for ${pref.type}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${pref.inApp ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => toggle(pref.type, "email")}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pref.email ? "bg-k-navy" : "bg-gray-200"}`}
                aria-label={`Toggle email for ${pref.type}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${pref.email ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-k-navy px-4 py-2 text-sm font-medium text-white hover:bg-k-navy/80 disabled:opacity-60 transition-colors">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? "Saving..." : "Save Preferences"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✓ Saved!</span>}
      </div>
    </div>
  );
}
