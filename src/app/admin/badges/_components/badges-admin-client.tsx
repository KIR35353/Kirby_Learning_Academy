"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { Award, Plus, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TRIGGERS = [
  "COURSE_COMPLETED", "PATH_COMPLETED", "CURRICULUM_COMPLETED",
  "ASSESSMENT_PASSED", "TOP_SCORER", "STREAK_7", "STREAK_30",
  "COMPLIANCE_CHAMPION", "MANUAL",
] as const;

type Trigger = typeof TRIGGERS[number];

const TRIGGER_LABELS: Record<Trigger, string> = {
  COURSE_COMPLETED: "Course Completed",
  PATH_COMPLETED: "Learning Path Completed",
  CURRICULUM_COMPLETED: "Curriculum Completed",
  ASSESSMENT_PASSED: "Assessment Passed",
  TOP_SCORER: "Top Scorer",
  STREAK_7: "7-Day Streak",
  STREAK_30: "30-Day Streak",
  COMPLIANCE_CHAMPION: "Compliance Champion",
  MANUAL: "Manual Award",
};

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  imageUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  trigger: z.enum(TRIGGERS),
  triggerValue: z.string().optional(),
  points: z.coerce.number().int().min(0).default(10),
});

type FormValues = z.infer<typeof schema>;

interface Badge {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  trigger: Trigger;
  triggerValue: string | null;
  points: number;
  isActive: boolean;
  _count: { userBadges: number };
}

export function BadgesAdminClient() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { points: 10 },
  });

  async function load() {
    const res = await fetch("/api/admin/badges");
    if (res.ok) setBadges(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function onSubmit(values: FormValues) {
    const res = await fetch("/api/admin/badges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      reset();
      setShowForm(false);
      load();
    }
  }

  async function toggleActive(badge: Badge) {
    await fetch(`/api/admin/badges/${badge.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !badge.isActive }),
    });
    load();
  }

  async function deleteBadge(id: string) {
    if (!confirm("Delete this badge? This will remove all user awards.")) return;
    await fetch(`/api/admin/badges/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-k-navy" />
          <h2 className="text-xl font-bold text-k-navy">Badges & Achievements</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg bg-k-navy px-4 py-2 text-sm font-medium text-white hover:bg-k-navy/80 transition-colors">
          <Plus className="h-4 w-4" /> New Badge
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Create Badge</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input {...register("name")} placeholder="e.g. Safety Star" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Points</Label>
              <Input type="number" {...register("points")} />
            </div>
            <div className="space-y-1.5">
              <Label>Trigger *</Label>
              <select {...register("trigger")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {TRIGGERS.map((t) => <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Trigger Value <span className="text-muted-foreground text-xs">(optional, e.g. courseId)</span></Label>
              <Input {...register("triggerValue")} placeholder="Leave blank for any" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Input {...register("description")} placeholder="What this badge represents" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Image URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input {...register("imageUrl")} placeholder="https://..." />
              {errors.imageUrl && <p className="text-xs text-destructive">{errors.imageUrl.message}</p>}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { reset(); setShowForm(false); }}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-k-navy text-white rounded-lg disabled:opacity-50 hover:bg-k-navy/80 transition-colors">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create Badge
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : badges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <Award className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p>No badges yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map((badge) => (
            <div key={badge.id} className={`rounded-xl border bg-card p-5 space-y-3 ${!badge.isActive ? "opacity-50" : "border-border"}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {badge.imageUrl
                    ? <img src={badge.imageUrl} alt={badge.name} className="h-10 w-10 rounded-lg object-cover" />
                    : <div className="h-10 w-10 rounded-lg bg-k-navy/10 flex items-center justify-center"><Award className="h-5 w-5 text-k-navy" /></div>}
                  <div>
                    <p className="font-semibold text-sm text-foreground">{badge.name}</p>
                    <p className="text-xs text-k-orange font-medium">{badge.points} pts</p>
                  </div>
                </div>
                <button onClick={() => deleteBadge(badge.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {badge.description && <p className="text-xs text-muted-foreground">{badge.description}</p>}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{TRIGGER_LABELS[badge.trigger]}</span>
                <span>{badge._count.userBadges} awarded</span>
              </div>
              <button onClick={() => toggleActive(badge)}
                className={`w-full rounded-md py-1.5 text-xs font-medium transition-colors ${badge.isActive ? "bg-muted hover:bg-muted/60 text-foreground" : "bg-k-navy text-white hover:bg-k-navy/80"}`}>
                {badge.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
