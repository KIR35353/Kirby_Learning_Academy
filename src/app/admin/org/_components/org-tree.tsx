"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BusinessUnitDialog } from "./business-unit-dialog";
import type { BusinessUnitRow } from "./types";

interface Props {
  units: BusinessUnitRow[];
  onRefresh: () => void;
}

interface TreeNode extends BusinessUnitRow {
  children: TreeNode[];
}

function buildTree(units: BusinessUnitRow[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const u of units) map.set(u.id, { ...u, children: [] });

  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // sort each level by sortOrder then name
  function sort(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((n) => ({ ...n, children: sort(n.children) }));
  }

  return sort(roots);
}

function TreeRow({
  node,
  depth,
  onEdit,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  onEdit: (unit: BusinessUnitRow) => void;
  onDelete: (unit: BusinessUnitRow) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <tr className="group border-b border-border/50 hover:bg-muted/30 transition-colors">
        <td className="py-3 pr-4">
          <div
            className="flex items-center gap-1"
            style={{ paddingLeft: `${depth * 24}px` }}
          >
            <button
              onClick={() => setExpanded((v) => !v)}
              className="h-5 w-5 shrink-0 text-muted-foreground"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {hasChildren ? (
                expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )
              ) : (
                <span className="inline-block h-4 w-4" />
              )}
            </button>
            <Building2 className="h-4 w-4 shrink-0 text-primary/70" />
            <span className="ml-1 font-medium text-sm">{node.name}</span>
            {node.code && (
              <span className="ml-2 text-xs text-muted-foreground">({node.code})</span>
            )}
          </div>
        </td>
        <td className="py-3 text-sm text-muted-foreground">{node._count.departments}</td>
        <td className="py-3 text-sm text-muted-foreground">{node._count.users}</td>
        <td className="py-3 text-right">
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(node)}
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(node)}
              title="Delete"
              disabled={node._count.users > 0 || node._count.departments > 0 || node.children.length > 0}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
      {expanded &&
        node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

export function OrgTree({ units, onRefresh }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessUnitRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BusinessUnitRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const tree = buildTree(units);

  function handleEdit(unit: BusinessUnitRow) {
    setEditing(unit);
    setDialogOpen(true);
  }

  function handleDelete(unit: BusinessUnitRow) {
    setDeleteTarget(unit);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/business-units/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        alert(data.error ?? "Delete failed");
        return;
      }
      onRefresh();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Business Units</h2>
          <p className="text-sm text-muted-foreground">
            Drag-and-drop reorder coming in a future update. Edit a unit to change its parent.
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
          Add Unit
        </Button>
      </div>

      {units.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No business units yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your first unit to start building the org hierarchy.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 text-left">Name</th>
                <th className="py-2.5 text-left">Depts</th>
                <th className="py-2.5 text-left">Users</th>
                <th className="py-2.5 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="px-4">
              {tree.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BusinessUnitDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
        allUnits={units}
        onSuccess={() => {
          setDialogOpen(false);
          setEditing(null);
          onRefresh();
        }}
      />

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="font-semibold">Delete &ldquo;{deleteTarget.name}&rdquo;?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
