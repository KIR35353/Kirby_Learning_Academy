"use client";

import { useState } from "react";
import { Building2, Plus, Pencil, Users, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TenantDialog } from "./tenant-dialog";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: string;
  _count: { users: number; departments: number; businessUnits: number };
}

interface Props {
  initial: TenantRow[];
}

export function TenantsTable({ initial }: Props) {
  const [tenants, setTenants] = useState<TenantRow[]>(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TenantRow | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/tenants");
    if (res.ok) setTenants(await res.json() as TenantRow[]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Business Units / Tenants</h2>
          <p className="text-sm text-muted-foreground">
            Each tenant is an isolated business unit with its own users and org hierarchy.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add Tenant
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tenants.map((t) => (
          <div
            key={t.id}
            className="group rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold leading-tight">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.slug}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  setEditing(t);
                  setDialogOpen(true);
                }}
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {t._count.users} users
              </span>
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                {t._count.businessUnits} units
              </span>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Created {new Date(t.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>

      <TenantDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
        onSuccess={() => {
          setDialogOpen(false);
          setEditing(null);
          refresh();
        }}
      />
    </div>
  );
}
