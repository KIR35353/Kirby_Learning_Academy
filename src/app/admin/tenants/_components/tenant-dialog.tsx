"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { BrandingImageUpload } from "./branding-image-upload";

// â”€â”€ Kirby brand defaults (shown in color picker when no override is set) â”€â”€â”€â”€â”€â”€
const BRAND_DEFAULTS = {
  primaryColor: "#cc3d00",
  primaryForegroundColor: "#ffffff",
  sidebarColor: "#001030",
  accentColor: "#1d5fa8",
} as const;

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  loginBannerUrl: string | null;
  appName: string | null;
  supportEmail: string | null;
  primaryColor: string | null;
  primaryForegroundColor: string | null;
  sidebarColor: string | null;
  accentColor: string | null;
}

type OrgItem = { id: string; name: string; userCount: number };

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
  domain: z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/, "e.g. kirbycorp.com")
    .optional()
    .or(z.literal("")),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  domain: z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/, "e.g. kirbycorp.com")
    .optional()
    .or(z.literal("")),
  // Images (populated by BrandingImageUpload)
  logoUrl: z.string().url().optional().or(z.literal("")),
  faviconUrl: z.string().url().optional().or(z.literal("")),
  loginBannerUrl: z.string().url().optional().or(z.literal("")),
  // Text
  appName: z.string().max(100).optional().or(z.literal("")),
  supportEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  // Colors (empty string = use default)
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color e.g. #cc3d00")
    .optional()
    .or(z.literal("")),
  primaryForegroundColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color e.g. #ffffff")
    .optional()
    .or(z.literal("")),
  sidebarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color e.g. #001030")
    .optional()
    .or(z.literal("")),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color e.g. #1d5fa8")
    .optional()
    .or(z.literal("")),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

function getApiErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Request failed";

  const data = payload as {
    error?: unknown;
    message?: unknown;
  };

  if (typeof data.error === "string" && data.error.trim()) return data.error;
  if (typeof data.message === "string" && data.message.trim()) return data.message;

  if (data.error && typeof data.error === "object") {
    const err = data.error as {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
    };
    const messages = [
      ...(err.formErrors ?? []),
      ...(Object.values(err.fieldErrors ?? {}).flat().filter(Boolean) as string[]),
    ];
    if (messages.length > 0) return messages.join("\n");
  }

  return "Request failed";
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: TenantRow | null;
  onSuccess: () => void;
}

// â”€â”€ Colour picker row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ColorField({
  label,
  defaultHex,
  value,
  onChange,
  error,
}: {
  label: string;
  defaultHex: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || defaultHex}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`${defaultHex} (default)`}
          className="font-mono text-xs"
          maxLength={7}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 shrink-0 px-2 text-xs text-muted-foreground"
            onClick={() => onChange("")}
          >
            Reset
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function TenantDialog({ open, onOpenChange, editing, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);

  // Edit-mode live org data
  const [departments, setDepartments] = useState<OrgItem[]>([]);
  const [locations, setLocations] = useState<OrgItem[]>([]);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [addingDept, setAddingDept] = useState(false);
  const [addingLoc, setAddingLoc] = useState(false);
  const [newDeptInput, setNewDeptInput] = useState("");
  const [newLocInput, setNewLocInput] = useState("");

  // Create-mode pending lists
  const [pendingDepts, setPendingDepts] = useState<string[]>([]);
  const [pendingLocs, setPendingLocs] = useState<string[]>([]);

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
    watch: watchEdit,
    setValue: setValueEdit,
    formState: { errors: editErrors, isSubmitting: isEditing },
  } = useForm<EditValues>({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    if (open) {
      setServerError(null);
      setDeptError(null);
      setLocError(null);
      setNewDeptInput("");
      setNewLocInput("");
      if (editing) {
        resetEdit({
          name: editing.name,
          domain: editing.domain ?? "",
          logoUrl: editing.logoUrl ?? "",
          faviconUrl: editing.faviconUrl ?? "",
          loginBannerUrl: editing.loginBannerUrl ?? "",
          appName: editing.appName ?? "",
          supportEmail: editing.supportEmail ?? "",
          primaryColor: editing.primaryColor ?? "",
          primaryForegroundColor: editing.primaryForegroundColor ?? "",
          sidebarColor: editing.sidebarColor ?? "",
          accentColor: editing.accentColor ?? "",
        });
        setLoadingOrg(true);
        Promise.all([
          fetch(`/api/admin/tenants/${editing.id}/departments`).then((r) => r.json()),
          fetch(`/api/admin/tenants/${editing.id}/locations`).then((r) => r.json()),
        ])
          .then(([dData, lData]) => {
            setDepartments((dData as { departments?: OrgItem[] }).departments ?? []);
            setLocations((lData as { locations?: OrgItem[] }).locations ?? []);
          })
          .catch(() => {})
          .finally(() => setLoadingOrg(false));
      } else {
        resetCreate({ name: "", slug: "", domain: "", logoUrl: "" });
        setPendingDepts([]);
        setPendingLocs([]);
        setDepartments([]);
        setLocations([]);
      }
    }
  }, [open, editing, resetCreate, resetEdit]);

  // â”€â”€ Create mode org helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function addPendingDept() {
    const name = newDeptInput.trim();
    if (!name || pendingDepts.includes(name)) return;
    setPendingDepts((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
    setNewDeptInput("");
  }
  function addPendingLoc() {
    const name = newLocInput.trim();
    if (!name || pendingLocs.includes(name)) return;
    setPendingLocs((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
    setNewLocInput("");
  }

  // â”€â”€ Edit mode org helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function addDept() {
    if (!editing || !newDeptInput.trim() || addingDept) return;
    setAddingDept(true);
    setDeptError(null);
    const res = await fetch(`/api/admin/tenants/${editing.id}/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newDeptInput.trim() }),
    });
    if (res.ok) {
      const data = (await res.json()) as { department: OrgItem };
      setDepartments((prev) =>
        [...prev, data.department].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewDeptInput("");
    } else {
      setDeptError(((await res.json()) as { error?: string }).error ?? "Failed to add");
    }
    setAddingDept(false);
  }

  async function deleteDept(item: OrgItem) {
    if (!editing) return;
    setDeptError(null);
    const res = await fetch(`/api/admin/tenants/${editing.id}/departments/${item.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDepartments((prev) => prev.filter((d) => d.id !== item.id));
    } else {
      setDeptError(((await res.json()) as { error?: string }).error ?? "Failed to delete");
    }
  }

  async function addLoc() {
    if (!editing || !newLocInput.trim() || addingLoc) return;
    setAddingLoc(true);
    setLocError(null);
    const res = await fetch(`/api/admin/tenants/${editing.id}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newLocInput.trim() }),
    });
    if (res.ok) {
      const data = (await res.json()) as { location: OrgItem };
      setLocations((prev) =>
        [...prev, data.location].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewLocInput("");
    } else {
      setLocError(((await res.json()) as { error?: string }).error ?? "Failed to add");
    }
    setAddingLoc(false);
  }

  async function deleteLoc(item: OrgItem) {
    if (!editing) return;
    setLocError(null);
    const res = await fetch(`/api/admin/tenants/${editing.id}/locations/${item.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setLocations((prev) => prev.filter((l) => l.id !== item.id));
    } else {
      setLocError(((await res.json()) as { error?: string }).error ?? "Failed to delete");
    }
  }

  // â”€â”€ Form submissions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function onSubmitCreate(values: CreateValues) {
    setServerError(null);
    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        domain: values.domain || null,
        logoUrl: values.logoUrl || null,
        departments: pendingDepts.length > 0 ? pendingDepts : undefined,
        locations: pendingLocs.length > 0 ? pendingLocs : undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setServerError(getApiErrorMessage(data));
      return;
    }
    onSuccess();
  }

  async function onSubmitEdit(values: EditValues) {
    if (!editing) return;
    setServerError(null);
    const nullify = (v: string | undefined) => v || null;
    const res = await fetch(`/api/admin/tenants/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        domain: nullify(values.domain),
        logoUrl: nullify(values.logoUrl),
        faviconUrl: nullify(values.faviconUrl),
        loginBannerUrl: nullify(values.loginBannerUrl),
        appName: nullify(values.appName),
        supportEmail: nullify(values.supportEmail),
        primaryColor: nullify(values.primaryColor),
        primaryForegroundColor: nullify(values.primaryForegroundColor),
        sidebarColor: nullify(values.sidebarColor),
        accentColor: nullify(values.accentColor),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setServerError(getApiErrorMessage(data));
      return;
    }
    onSuccess();
    window.location.reload();
  }

  if (!open) return null;

  const isEditMode = !!editing;

  // â”€â”€ Shared Departments & Locations section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const orgSection = (
    <div className="border-t border-border pt-4 mt-2">
      <p className="text-sm font-semibold mb-3">Departments &amp; Locations</p>
      {isEditMode && loadingOrg ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {/* Departments */}
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Departments
            </p>
            <ul className="mb-2 max-h-44 space-y-0.5 overflow-y-auto">
              {(isEditMode
                ? departments
                : pendingDepts.map((n) => ({ id: n, name: n, userCount: 0 }))
              ).map((d) => (
                <li
                  key={d.id}
                  className="group flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50"
                >
                  <span className="flex-1 truncate text-sm">{d.name}</span>
                  {isEditMode && d.userCount > 0 && (
                    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                      {d.userCount}u
                    </span>
                  )}
                  <button
                    type="button"
                    title={
                      isEditMode && d.userCount > 0
                        ? `Cannot delete: ${d.userCount} user(s) assigned`
                        : "Remove"
                    }
                    disabled={isEditMode && d.userCount > 0}
                    onClick={() =>
                      isEditMode
                        ? deleteDept(d as OrgItem)
                        : setPendingDepts((prev) => prev.filter((n) => n !== d.name))
                    }
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-25 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {(isEditMode ? departments : pendingDepts).length === 0 && (
                <li className="px-1.5 py-1 text-xs text-muted-foreground">None added yet</li>
              )}
            </ul>
            {deptError && <p className="mb-1 text-xs text-destructive">{deptError}</p>}
            <div className="flex gap-1.5">
              <Input
                value={newDeptInput}
                onChange={(e) => setNewDeptInput(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    isEditMode ? void addDept() : addPendingDept();
                  }
                }}
                placeholder="New department…"
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="sm"
                onClick={isEditMode ? () => void addDept() : addPendingDept}
                disabled={!newDeptInput.trim() || (isEditMode && addingDept)}
                className="h-8 shrink-0 px-2"
              >
                {isEditMode && addingDept ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Locations */}
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Locations
            </p>
            <ul className="mb-2 max-h-44 space-y-0.5 overflow-y-auto">
              {(isEditMode
                ? locations
                : pendingLocs.map((n) => ({ id: n, name: n, userCount: 0 }))
              ).map((l) => (
                <li
                  key={l.id}
                  className="group flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50"
                >
                  <span className="flex-1 truncate text-sm">{l.name}</span>
                  {isEditMode && l.userCount > 0 && (
                    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                      {l.userCount}u
                    </span>
                  )}
                  <button
                    type="button"
                    title={
                      isEditMode && l.userCount > 0
                        ? `Cannot delete: ${l.userCount} user(s) assigned`
                        : "Remove"
                    }
                    disabled={isEditMode && l.userCount > 0}
                    onClick={() =>
                      isEditMode
                        ? deleteLoc(l as OrgItem)
                        : setPendingLocs((prev) => prev.filter((n) => n !== l.name))
                    }
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-25 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {(isEditMode ? locations : pendingLocs).length === 0 && (
                <li className="px-1.5 py-1 text-xs text-muted-foreground">None added yet</li>
              )}
            </ul>
            {locError && <p className="mb-1 text-xs text-destructive">{locError}</p>}
            <div className="flex gap-1.5">
              <Input
                value={newLocInput}
                onChange={(e) => setNewLocInput(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    isEditMode ? void addLoc() : addPendingLoc();
                  }
                }}
                placeholder="New location…"
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="sm"
                onClick={isEditMode ? () => void addLoc() : addPendingLoc}
                disabled={!newLocInput.trim() || (isEditMode && addingLoc)}
                className="h-8 shrink-0 px-2"
              >
                {isEditMode && addingLoc ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-semibold">
          {editing ? `Edit "${editing.name}"` : "Add Tenant"}
        </h2>

        {serverError && (
          <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

        {/* â”€â”€ EDIT FORM â”€â”€ */}
        {editing ? (
          <form onSubmit={handleEdit(onSubmitEdit)} className="mt-5 space-y-4">
            {/* Identity */}
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Name *</Label>
              <Input id="t-name" {...registerEdit("name")} />
              {editErrors.name && <p className="text-xs text-destructive">{editErrors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-domain">Email Domain</Label>
              <Input id="t-domain" {...registerEdit("domain")} placeholder="kirbycorp.com" />
              <p className="text-xs text-muted-foreground">
                Used for SSO sign-in only. Admin-created users are assigned a tenant explicitly.
              </p>
              {editErrors.domain && <p className="text-xs text-destructive">{editErrors.domain.message}</p>}
            </div>

            {/* Branding section */}
            <div className="border-t border-border pt-4">
              <p className="mb-4 text-sm font-semibold">Branding</p>

              {/* Images row */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <BrandingImageUpload
                  label="Logo"
                  value={watchEdit("logoUrl") || null}
                  onChange={(url) => setValueEdit("logoUrl", url ?? "", { shouldDirty: true })}
                  tenantId={editing.id}
                  type="logo"
                  hint="Recommended: 200Ã—60px"
                />
                <BrandingImageUpload
                  label="Favicon"
                  value={watchEdit("faviconUrl") || null}
                  onChange={(url) => setValueEdit("faviconUrl", url ?? "", { shouldDirty: true })}
                  tenantId={editing.id}
                  type="favicon"
                  hint="32Ã—32px ICO or PNG"
                />
                <BrandingImageUpload
                  label="Login Banner"
                  value={watchEdit("loginBannerUrl") || null}
                  onChange={(url) => setValueEdit("loginBannerUrl", url ?? "", { shouldDirty: true })}
                  tenantId={editing.id}
                  type="loginBanner"
                  hint="1920Ã—600px recommended"
                />
              </div>

              {/* App name + support email */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <Label htmlFor="t-appname">Portal Name</Label>
                  <Input
                    id="t-appname"
                    {...registerEdit("appName")}
                    placeholder="Kirby Learning Academy"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown in browser title and emails
                  </p>
                  {editErrors.appName && (
                    <p className="text-xs text-destructive">{editErrors.appName.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-support">Support Email</Label>
                  <Input
                    id="t-support"
                    {...registerEdit("supportEmail")}
                    placeholder="training@example.com"
                    type="email"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown in footer and error pages
                  </p>
                  {editErrors.supportEmail && (
                    <p className="text-xs text-destructive">{editErrors.supportEmail.message}</p>
                  )}
                </div>
              </div>

              {/* Color pickers */}
              <div className="grid grid-cols-2 gap-4">
                <ColorField
                  label="Primary Color (buttons, highlights)"
                  defaultHex={BRAND_DEFAULTS.primaryColor}
                  value={watchEdit("primaryColor") ?? ""}
                  onChange={(v) => setValueEdit("primaryColor", v, { shouldDirty: true })}
                  error={editErrors.primaryColor?.message}
                />
                <ColorField
                  label="Primary Foreground (text on buttons)"
                  defaultHex={BRAND_DEFAULTS.primaryForegroundColor}
                  value={watchEdit("primaryForegroundColor") ?? ""}
                  onChange={(v) => setValueEdit("primaryForegroundColor", v, { shouldDirty: true })}
                  error={editErrors.primaryForegroundColor?.message}
                />
                <ColorField
                  label="Sidebar Background"
                  defaultHex={BRAND_DEFAULTS.sidebarColor}
                  value={watchEdit("sidebarColor") ?? ""}
                  onChange={(v) => setValueEdit("sidebarColor", v, { shouldDirty: true })}
                  error={editErrors.sidebarColor?.message}
                />
                <ColorField
                  label="Accent / Focus Ring"
                  defaultHex={BRAND_DEFAULTS.accentColor}
                  value={watchEdit("accentColor") ?? ""}
                  onChange={(v) => setValueEdit("accentColor", v, { shouldDirty: true })}
                  error={editErrors.accentColor?.message}
                />
              </div>
            </div>

            {orgSection}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isEditing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isEditing}>
                {isEditing ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        ) : (
          /* â”€â”€ CREATE FORM â”€â”€ */
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
              <Label htmlFor="tc-domain">Email Domain</Label>
              <Input id="tc-domain" {...registerCreate("domain")} placeholder="kirbycorp.com" />
              <p className="text-xs text-muted-foreground">
                Used for SSO sign-in only. Admin-created users are assigned a tenant explicitly.
              </p>
              {createErrors.domain && <p className="text-xs text-destructive">{createErrors.domain.message}</p>}
            </div>

            <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Logo, favicon, colors, and portal name can be configured after creating the tenant.
            </p>

            {orgSection}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating…" : "Create Tenant"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
