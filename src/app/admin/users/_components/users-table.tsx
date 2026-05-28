"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserFormDialog } from "./user-form-dialog";
import { ImportDialog } from "./import-dialog";
import {
  Search,
  UserPlus,
  Upload,
  ShieldCheck,
  HardHat,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  CircleOff,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Department = { id: string; name: string };
type Location = { id: string; name: string };
type Role = { id: string; name: string };
type Tenant = { id: string; name: string };

type User = {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isContractor: boolean;
  hireDate: string | null;
  createdAt: string;
  department: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  jobTitle: { id: string; name: string } | null;
  tenant: { id: string; name: string } | null;
  roles: { role: { id: string; name: string } }[];
};

type Pagination = { page: number; limit: number; total: number; pages: number };

interface Props {
  departments: Department[];
  locations: Location[];
  allRoles: Role[];
  tenants: Tenant[];
  isSuperAdmin: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  TENANT_ADMIN: "Admin",
  MANAGER: "Manager",
  INSTRUCTOR: "Instructor",
  STUDENT: "Student",
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-800",
  TENANT_ADMIN: "bg-blue-100 text-blue-800",
  MANAGER: "bg-green-100 text-green-800",
  INSTRUCTOR: "bg-teal-100 text-teal-800",
  STUDENT: "bg-gray-100 text-gray-700",
};

export function UsersTable({ departments, locations, allRoles, tenants, isSuperAdmin }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    pages: 1,
  });
  const [search, setSearch] = useState("");
  const [filterTenantId, setFilterTenantId] = useState("");
  const [filterActive, setFilterActive] = useState<string>("");
  const [filterContractor, setFilterContractor] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const fetchUsers = useCallback(
    async (page = 1) => {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        ...(isSuperAdmin && filterTenantId && { tenantId: filterTenantId }),
        ...(search && { search }),
        ...(filterActive && { isActive: filterActive }),
        ...(filterContractor && { isContractor: filterContractor }),
      });
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setPagination(data.pagination);
      }
      setLoading(false);
    },
    [search, filterTenantId, filterActive, filterContractor, isSuperAdmin],
  );

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(1), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, filterTenantId, filterActive, filterContractor, fetchUsers]);

  async function deactivateUser(id: string) {
    if (!confirm("Deactivate this user? They will no longer be able to sign in.")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    fetchUsers(pagination.page);
  }

  async function permanentlyDeleteUser(user: User) {
    const confirmed = confirm(
      `Permanently delete "${
        user.displayName ?? user.name ?? user.email
      }" (${user.email})?\n\nThis will erase all their enrollments, certifications, assessments, and account data. This cannot be undone.`,
    );
    if (!confirmed) return;
    const res = await fetch(`/api/admin/users/${user.id}?permanent=true`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to delete user.");
      return;
    }
    fetchUsers(pagination.page);
  }

  const initials = (u: User) => {
    const n = u.displayName ?? u.name ?? u.email;
    return n
      .split(" ")
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Users</h2>
          <p className="text-sm text-muted-foreground">
            {pagination.total} total user{pagination.total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-[#002060] text-white hover:bg-[#001245]"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isSuperAdmin && (
          <select
            value={filterTenantId}
            onChange={(e) => setFilterTenantId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">All tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="">All status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select
          value={filterContractor}
          onChange={(e) => setFilterContractor(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="">All types</option>
          <option value="false">Employees</option>
          <option value="true">Contractors</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                User
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                Department / Location
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                Roles
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                Tenant
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border animate-pulse">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-[#002060] text-white text-xs">
                          {initials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          {user.displayName ?? user.name ?? "—"}
                          {user.isContractor && (
                            <HardHat className="h-3.5 w-3.5 text-orange-500" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-foreground">{user.department?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.location?.name ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map(({ role }) => (
                        <span
                          key={role.id}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role.name] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {ROLE_LABELS[role.name] ?? role.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="text-sm text-foreground">
                      {user.tenant?.name ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {user.isActive ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <TooltipProvider>
                      <div className="flex items-center justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditUser(user)}
                              className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600"
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        {user.isActive && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deactivateUser(user.id)}
                                className="h-8 w-8 p-0 hover:bg-amber-100 hover:text-amber-600"
                              >
                                <CircleOff className="h-4 w-4" />
                                <span className="sr-only">Deactivate</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Deactivate</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => permanentlyDeleteUser(user)}
                              className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete Permanently</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchUsers(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages}
              onClick={() => fetchUsers(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create dialog */}
      <UserFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        departments={departments}
        locations={locations}
        allRoles={allRoles}
        tenants={tenants}
        isSuperAdmin={isSuperAdmin}
        onSuccess={() => fetchUsers(1)}
      />

      {/* Edit dialog */}
      {editUser && (
        <UserFormDialog
          open={!!editUser}
          onOpenChange={(open) => !open && setEditUser(null)}
          user={editUser}
          departments={departments}
          locations={locations}
          allRoles={allRoles}
          tenants={tenants}
          isSuperAdmin={isSuperAdmin}
          onSuccess={() => {
            fetchUsers(pagination.page);
            setEditUser(null);
          }}
        />
      )}

      {/* Import dialog */}
      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onComplete={() => { setImportOpen(false); fetchUsers(1); }}
        />
      )}
    </div>
  );
}
