"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, X, Copy, Check } from "lucide-react";

type Department = { id: string; name: string };
type Location = { id: string; name: string };
type Role = { id: string; name: string };
type Tenant = { id: string; name: string };

type User = {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  isActive: boolean;
  isContractor: boolean;
  hireDate: string | null;
  department: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  jobTitle: { id: string; name: string } | null;
  tenant: { id: string; name: string } | null;
  roles: { role: { id: string; name: string } }[];
};

const ROLE_NAMES = [
  "SUPER_ADMIN",
  "TENANT_ADMIN",
  "MANAGER",
  "INSTRUCTOR",
  "STUDENT",
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  TENANT_ADMIN: "Tenant Admin",
  MANAGER: "Manager",
  INSTRUCTOR: "Instructor",
  STUDENT: "Student",
};

const createSchema = z.object({
  email: z.string().email("Enter a valid email"),
  name: z.string().min(1, "Name is required"),
  tenantId: z.string().optional(),
  isContractor: z.boolean(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  jobTitle: z.string().optional(),
  hireDate: z.string().optional(),
  roleNames: z.array(z.string()).min(1, "Select at least one role"),
  newPassword: z.string().min(8, "Minimum 8 characters").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof createSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
  departments: Department[];
  locations: Location[];
  allRoles: Role[];
  tenants: Tenant[];
  isSuperAdmin: boolean;
  onSuccess: () => void;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  departments,
  locations,
  allRoles,
  tenants,
  isSuperAdmin,
  onSuccess,
}: Props) {
  const isEdit = !!user;
  const [inviteText, setInviteText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      email: "",
      name: "",
      tenantId: "",
      isContractor: false,
      departmentId: "",
      locationId: "",
      jobTitle: "",
      hireDate: "",
      roleNames: ["EMPLOYEE"],
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        email: user.email,
        name: user.name ?? "",
        tenantId: user.tenant?.id ?? "",
        isContractor: user.isContractor,
        departmentId: user.department?.id ?? "",
        locationId: user.location?.id ?? "",
        jobTitle: user.jobTitle?.name ?? "",
        hireDate: user.hireDate ? user.hireDate.split("T")[0] : "",
        roleNames: user.roles.map((r) => r.role.name),
      });
    } else {
      reset({
        email: "",
        name: "",
        tenantId: "",
        isContractor: false,
        departmentId: "",
        locationId: "",
        jobTitle: "",
        hireDate: "",
        roleNames: ["EMPLOYEE"],
      });
    }
  }, [user, reset, open]);

  const selectedRoles = watch("roleNames") ?? [];

  function toggleRole(name: string) {
    if (selectedRoles.includes(name)) {
      setValue(
        "roleNames",
        selectedRoles.filter((r) => r !== name),
        { shouldValidate: true },
      );
    } else {
      setValue("roleNames", [...selectedRoles, name], { shouldValidate: true });
    }
  }

  async function onSubmit(values: FormValues) {
    const url = isEdit ? `/api/admin/users/${user.id}` : "/api/admin/users";
    const method = isEdit ? "PATCH" : "POST";

    const body: Record<string, unknown> = {
      name: values.name,
      isContractor: values.isContractor,
      departmentId: values.departmentId || null,
      locationId: values.locationId || null,
      jobTitle: values.jobTitle || null,
      hireDate: values.hireDate || null,
      roleNames: values.roleNames,
      ...(isEdit && values.newPassword ? { newPassword: values.newPassword } : {}),
    };

    if (!isEdit) {
      body.email = values.email;
    }
    if (isSuperAdmin && values.tenantId) {
      body.tenantId = values.tenantId;
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({})) as { tempPassword?: string; loginUrl?: string };
      if (!isEdit && data.tempPassword) {
        const loginUrl = data.loginUrl ?? `${window.location.origin}/login`;
        const name = values.name || values.email;
        setInviteText(
`Hi ${name},

Your Kirby Learning Academy account has been created.

Login: ${loginUrl}
Email: ${values.email}
Temporary password: ${data.tempPassword}

Please change your password after your first login.`
        );
        onSuccess();
      } else {
        onSuccess();
        onOpenChange(false);
      }
    } else {
      const data = await res.json().catch(() => ({}));
      alert((data as { error?: string }).error ?? "An error occurred");
    }
  }

  if (!open) return null;

  // ── Invite text modal (shown after create when email is not configured) ──
  if (inviteText) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 w-full max-w-lg rounded-xl bg-background shadow-2xl border border-border">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">User Created — Share Invite</h2>
            <button
              onClick={() => { setInviteText(null); onOpenChange(false); }}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-6 py-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              Email delivery is not configured. Copy this invite and send it manually.
            </p>
            <textarea
              readOnly
              value={inviteText}
              rows={9}
              className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm font-mono text-foreground resize-none focus:outline-none"
              onFocus={(e) => e.target.select()}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(inviteText).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
              >
                {copied ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button
                className="bg-[#002060] text-white hover:bg-[#001245]"
                onClick={() => { setInviteText(null); onOpenChange(false); }}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-background shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? "Edit User" : "Add User"}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" placeholder="Jane Smith" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Email — read-only on edit */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="jane@kirbycorp.com"
              readOnly={isEdit}
              className={isEdit ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          {isEdit ? (
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">
                Set Password{" "}
                <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="New password…"
                autoComplete="new-password"
                {...register("newPassword")}
              />
              {errors.newPassword && (
                <p className="text-xs text-destructive">{errors.newPassword.message}</p>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              A random temporary password will be generated and emailed to the user.
            </div>
          )}

          {/* Tenant selector — SUPER_ADMIN only */}
          {isSuperAdmin && tenants.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="tenantId">Tenant</Label>
              <select
                id="tenantId"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register("tenantId")}
              >
                <option value="">— Select tenant —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {errors.tenantId && (
                <p className="text-xs text-destructive">{errors.tenantId.message}</p>
              )}
            </div>
          )}

          {/* Org fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="departmentId">Department</Label>
              <select
                id="departmentId"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register("departmentId")}
              >
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="locationId">Location</Label>
              <select
                id="locationId"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register("locationId")}
              >
                <option value="">None</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                placeholder="e.g. Marine Officer"
                {...register("jobTitle")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hireDate">Hire Date</Label>
              <Input id="hireDate" type="date" {...register("hireDate")} />
            </div>
          </div>

          {/* Contractor toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isContractor"
              className="h-4 w-4 rounded border-input"
              {...register("isContractor")}
            />
            <Label htmlFor="isContractor" className="font-normal cursor-pointer">
              Contractor / External User
            </Label>
          </div>

          {/* Roles */}
          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-2">
              {(allRoles.length > 0 ? allRoles : ROLE_NAMES.map((n) => ({ id: n, name: n }))).map(
                (role) => {
                  const isSelected = selectedRoles.includes(role.name);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleRole(role.name)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        isSelected
                          ? "border-[#002060] bg-[#002060] text-white"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      {ROLE_LABELS[role.name] ?? role.name}
                    </button>
                  );
                },
              )}
            </div>
            {errors.roleNames && (
              <p className="text-xs text-destructive">{errors.roleNames.message}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#002060] text-white hover:bg-[#001245]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Create User"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
