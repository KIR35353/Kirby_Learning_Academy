"use client";

import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, X } from "lucide-react";
import type { CourseRow } from "./types";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  targetAudience: z.string().optional(),
  isContractorVisible: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

interface TenantOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  course: CourseRow | null;
  isSuperAdmin: boolean;
  currentTenantId: string;
  tenants: TenantOption[];
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORIES = [
  "Safety & Compliance",
  "OSHA",
  "Maritime Operations",
  "Environmental",
  "Leadership",
  "Technical Skills",
  "Onboarding",
  "HR & Policy",
  "Other",
];

export function CourseDialog({
  open,
  course,
  isSuperAdmin,
  currentTenantId,
  tenants,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!course;
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(course?.tags?.map((t) => t.tag) ?? []);
  const [compTags, setCompTags] = useState<string[]>(course?.complianceTags ?? []);
  const [compInput, setCompInput] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>(
    course?.courseTenants?.map((ct) => ct.tenantId) ?? [currentTenantId],
  );

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      title: course?.title ?? "",
      description: course?.description ?? "",
      category: course?.category ?? "",
      targetAudience: course?.targetAudience ?? "",
      isContractorVisible: course?.isContractorVisible ?? false,
    },
  });

  useEffect(() => {
    setTags(course?.tags?.map((t) => t.tag) ?? []);
    setCompTags(course?.complianceTags ?? []);
    setSelectedTenantIds(course?.courseTenants?.map((ct) => ct.tenantId) ?? [currentTenantId]);
    reset({
      title: course?.title ?? "",
      description: course?.description ?? "",
      category: course?.category ?? "",
      targetAudience: course?.targetAudience ?? "",
      isContractorVisible: course?.isContractorVisible ?? false,
    });
  }, [course, currentTenantId, reset]);

  function addTag(val: string, list: string[], setList: (v: string[]) => void, setInput: (v: string) => void) {
    const trimmed = val.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
    setInput("");
  }

  function removeTag(val: string, list: string[], setList: (v: string[]) => void) {
    setList(list.filter((t) => t !== val));
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const normalizedTenantIds = isSuperAdmin
      ? Array.from(new Set(selectedTenantIds)).filter(Boolean)
      : [currentTenantId];

    if (isSuperAdmin && normalizedTenantIds.length === 0) {
      setServerError("Select at least one tenant.");
      return;
    }

    const payload = {
      ...values,
      tags,
      complianceTags: compTags,
      ...(isSuperAdmin ? { tenantIds: normalizedTenantIds } : {}),
    };

    const res = await fetch(
      isEdit ? `/api/admin/courses/${course!.id}` : "/api/admin/courses",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const data = await res.json();
      setServerError(data.error ?? "Failed to save course");
      return;
    }

    const saved = (await res.json()) as CourseRow;

    if (isSuperAdmin) {
      const tenantRes = await fetch(`/api/admin/courses/${saved.id}/tenants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantIds: normalizedTenantIds }),
      });

      if (!tenantRes.ok) {
        const data = await tenantRes.json().catch(() => ({}));
        setServerError((data as { error?: string }).error ?? "Failed to save tenant assignments");
        return;
      }
    }

    reset();
    setTags([]);
    setCompTags([]);
    setSelectedTenantIds([currentTenantId]);
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full max-w-lg bg-[#0a1628] border-white/10 text-white overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-white">{isEdit ? "Edit Course" : "New Course"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
          {serverError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {serverError}
            </p>
          )}

          <div className="space-y-1.5">
            <Label className="text-white/80">Title *</Label>
            <Input {...register("title")} className="bg-white/5 border-white/10 text-white" />
            {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Description</Label>
            <textarea
              {...register("description")}
              rows={3}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
              placeholder="What will learners achieve?"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Category</Label>
            <select
              {...register("category")}
              className="w-full rounded-md border border-white/10 bg-[#0a1628] px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value="">— select —</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Target Audience</Label>
            <Input
              {...register("targetAudience")}
              placeholder="e.g. Deck Officers, All Crew"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          {isSuperAdmin ? (
            <div className="space-y-2">
              <Label className="text-white/80">Tenant Assignment</Label>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-white/10 bg-white/5 p-2">
                {tenants.map((tenant) => {
                  const checked = selectedTenantIds.includes(tenant.id);
                  return (
                    <label key={tenant.id} className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#cc3d00]"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTenantIds((prev) => Array.from(new Set([...prev, tenant.id])));
                          } else {
                            setSelectedTenantIds((prev) => prev.filter((id) => id !== tenant.id));
                          }
                        }}
                      />
                      <span>{tenant.name}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-white/50">Super Admin can assign this course to multiple tenants.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-white/80">Tenant</Label>
              <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                Current tenant only
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-white/80">Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                  {t}
                  <button type="button" onClick={() => removeTag(t, tags, setTags)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagInput, tags, setTags, setTagInput);
                  }
                }}
                placeholder="Add tag, press Enter"
                className="bg-white/5 border-white/10 text-white text-sm"
              />
              <Button type="button" variant="outline" size="sm"
                className="border-white/10 text-white/70"
                onClick={() => addTag(tagInput, tags, setTags, setTagInput)}>
                Add
              </Button>
            </div>
          </div>

          {/* Compliance tags */}
          <div className="space-y-1.5">
            <Label className="text-white/80">Compliance Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {compTags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-amber-900/40 px-2 py-0.5 text-xs text-amber-300">
                  {t}
                  <button type="button" onClick={() => removeTag(t, compTags, setCompTags)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={compInput}
                onChange={(e) => setCompInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(compInput, compTags, setCompTags, setCompInput);
                  }
                }}
                placeholder="OSHA, USCG, Maritime…"
                className="bg-white/5 border-white/10 text-white text-sm"
              />
              <Button type="button" variant="outline" size="sm"
                className="border-white/10 text-white/70"
                onClick={() => addTag(compInput, compTags, setCompTags, setCompInput)}>
                Add
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="contractor"
              type="checkbox"
              {...register("isContractorVisible")}
              className="h-4 w-4 accent-[#cc3d00]"
            />
            <label htmlFor="contractor" className="text-sm text-white/70">
              Visible to contractors
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
            <Button type="button" variant="ghost" className="text-white/60" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#cc3d00] text-white hover:bg-[#b33400]"
            >
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
