"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, X } from "lucide-react";

type Department = { id: string; name: string };
type Location = { id: string; name: string };
type JobTitle = { id: string; name: string };
type Role = { id: string; name: string };

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
  roles: { role: { id: string; name: string } }[];
};

const ROLE_NAMES = [
  "SUPER_ADMIN",
  "TENANT_ADMIN",
  "COMPLIANCE_OFFICER",
  "MANAGER",
  "INSTRUCTOR",
  "EMPLOYEE",
  "CONTRACTOR",
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  TENANT_ADMIN: "Tenant Admin",
  COMPLIANCE_OFFICER: "Compliance Officer",
  MANAGER: "Manager",
  INSTRUCTOR: "Instructor",
  EMPLOYEE: "Employee",
  CONTRACTOR: "Contractor",
};

const createSchema = z.object({
  email: z.string().email("Enter a valid email"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Minimum 8 characters").optional().or(z.literal("")),
  isContractor: z.boolean(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  jobTitleId: z.string().optional(),
  hireDate: z.string().optional(),
  roleNames: z.array(z.string()).min(1, "Select at least one role"),
});

type FormValues = z.infer<typeof createSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
  departments: Department[];
  locations: Location[];
  jobTitles: JobTitle[];
  allRoles: Role[];
  onSuccess: () => void;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  departments,
  locations,
  jobTitles,
  allRoles,
  onSuccess,
}: Props) {
  const isEdit = !!user;

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
      password: "",
      isContractor: false,
      departmentId: "",
      locationId: "",
      jobTitleId: "",
      hireDate: "",
      roleNames: ["EMPLOYEE"],
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        email: user.email,
        name: user.name ?? "",
        password: "",
        isContractor: user.isContractor,
        departmentId: user.department?.id ?? "",
        locationId: user.location?.id ?? "",
        jobTitleId: user.jobTitle?.id ?? "",
        hireDate: user.hireDate ? user.hireDate.split("T")[0] : "",
        roleNames: user.roles.map((r) => r.role.name),
      });
    } else {
      reset({
        email: "",
        name: "",
        password: "",
        isContractor: false,
        departmentId: "",
        locationId: "",
        jobTitleId: "",
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
      jobTitleId: values.jobTitleId || null,
      hireDate: values.hireDate || null,
      roleNames: values.roleNames,
    };

    if (!isEdit) {
      body.email = values.email;
      if (values.password) body.password = values.password;
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      onSuccess();
      onOpenChange(false);
    } else {
      const data = await res.json().catch(() => ({}));
      alert((data as { error?: string }).error ?? "An error occurred");
    }
  }

  if (!open) return null;

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

          {/* Password (create only) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="password">
                Password{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Leave blank to send reset email"
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
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
              <Label htmlFor="jobTitleId">Job Title</Label>
              <select
                id="jobTitleId"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register("jobTitleId")}
              >
                <option value="">None</option>
                {jobTitles.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
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
