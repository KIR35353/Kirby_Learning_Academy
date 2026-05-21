"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: TenantRow | null;
  onSuccess: () => void;
}

export function TenantDialog({ open, onOpenChange, editing, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register: registerCreate,
    handleSubmit: handleCreate,
    reset: resetCreate,
    formState: { errors: createErrors, isSubmitting: isCreating },
  } = useForm<CreateValues>({ resolver: zodResolver(createSchema) });

  const {
    register: registerEdit,
    handleSubmit: handleEdit,
    reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isEditing },
  } = useForm<EditValues>({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    if (open) {
      setServerError(null);
      if (editing) {
        resetEdit({ name: editing.name, logoUrl: editing.logoUrl ?? "" });
      } else {
        resetCreate({ name: "", slug: "", logoUrl: "" });
      }
    }
  }, [open, editing, resetCreate, resetEdit]);

  async function onSubmitCreate(values: CreateValues) {
    setServerError(null);
    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, logoUrl: values.logoUrl || null }),
    });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      setServerError(data.error ?? "Failed to create tenant");
      return;
    }
    onSuccess();
  }

  async function onSubmitEdit(values: EditValues) {
    if (!editing) return;
    setServerError(null);
    const res = await fetch(`/api/admin/tenants/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, logoUrl: values.logoUrl || null }),
    });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      setServerError(data.error ?? "Failed to update tenant");
      return;
    }
    onSuccess();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-semibold">
          {editing ? `Edit "${editing.name}"` : "Add Tenant"}
        </h2>

        {serverError && (
          <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

        {editing ? (
          <form onSubmit={handleEdit(onSubmitEdit)} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Name *</Label>
              <Input id="t-name" {...registerEdit("name")} />
              {editErrors.name && <p className="text-xs text-destructive">{editErrors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-logo">Logo URL</Label>
              <Input id="t-logo" {...registerEdit("logoUrl")} placeholder="https://…" />
              {editErrors.logoUrl && <p className="text-xs text-destructive">{editErrors.logoUrl.message}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isEditing}>Cancel</Button>
              <Button type="submit" disabled={isEditing}>{isEditing ? "Saving…" : "Save Changes"}</Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreate(onSubmitCreate)} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tc-name">Name *</Label>
              <Input id="tc-name" {...registerCreate("name")} placeholder="Marine Operations" />
              {createErrors.name && <p className="text-xs text-destructive">{createErrors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-slug">Slug *</Label>
              <Input id="tc-slug" {...registerCreate("slug")} placeholder="marine-operations" />
              {createErrors.slug && <p className="text-xs text-destructive">{createErrors.slug.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-logo">Logo URL</Label>
              <Input id="tc-logo" {...registerCreate("logoUrl")} placeholder="https://…" />
              {createErrors.logoUrl && <p className="text-xs text-destructive">{createErrors.logoUrl.message}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>Cancel</Button>
              <Button type="submit" disabled={isCreating}>{isCreating ? "Creating…" : "Create Tenant"}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
