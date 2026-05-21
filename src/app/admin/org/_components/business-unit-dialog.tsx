"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BusinessUnitRow } from "./types";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  code: z.string().max(20).optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: BusinessUnitRow | null;
  allUnits: BusinessUnitRow[];
  onSuccess: () => void;
}

export function BusinessUnitDialog({ open, onOpenChange, editing, allUnits, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        name: editing?.name ?? "",
        code: editing?.code ?? "",
        parentId: editing?.parentId ?? "",
        sortOrder: editing?.sortOrder ?? 0,
      });
      setServerError(null);
    }
  }, [open, editing, reset]);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const body = {
      name: values.name,
      code: values.code || null,
      parentId: values.parentId || null,
      sortOrder: values.sortOrder,
    };

    const url = editing
      ? `/api/admin/business-units/${editing.id}`
      : "/api/admin/business-units";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json() as { error?: string };
      setServerError(data.error ?? "An error occurred");
      return;
    }

    onSuccess();
  }

  // Filter out self and descendants from parent options to prevent cycles
  const parentOptions = allUnits.filter((u) => u.id !== editing?.id);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-semibold">
          {editing ? "Edit Business Unit" : "Add Business Unit"}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="bu-name">Name *</Label>
            <Input id="bu-name" {...register("name")} placeholder="Marine Operations" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bu-code">Code</Label>
            <Input id="bu-code" {...register("code")} placeholder="MAR" />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bu-parent">Parent Unit</Label>
            <select
              id="bu-parent"
              {...register("parentId")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— None (top-level) —</option>
              {parentOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bu-sort">Sort Order</Label>
            <Input
              id="bu-sort"
              type="number"
              {...register("sortOrder", { valueAsNumber: true })}
              placeholder="0"
              className="w-28"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : editing ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
