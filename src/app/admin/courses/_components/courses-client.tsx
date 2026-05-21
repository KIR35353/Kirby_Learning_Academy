"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Upload,
  MoreHorizontal,
  BookOpen,
  CheckCircle2,
  Clock,
  Archive,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CourseDialog } from "./course-dialog";
import { UploadDialog } from "./upload-dialog";
import type { CourseRow } from "./types";

interface Props {
  initialCourses: CourseRow[];
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-zinc-700 text-zinc-300" },
  REVIEW: { label: "In Review", className: "bg-amber-900/60 text-amber-300" },
  PUBLISHED: { label: "Published", className: "bg-emerald-900/60 text-emerald-300" },
  ARCHIVED: { label: "Archived", className: "bg-red-900/40 text-red-400" },
};

export function CoursesClient({ initialCourses }: Props) {
  const [courses, setCourses] = useState<CourseRow[]>(initialCourses);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<CourseRow | null>(null);
  const [uploadCourse, setUploadCourse] = useState<CourseRow | null>(null);
  const [, startTransition] = useTransition();

  const filtered = courses.filter((c) => {
    const matchQuery =
      !query ||
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.category?.toLowerCase().includes(query.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchQuery && matchStatus;
  });

  async function refresh() {
    const res = await fetch("/api/admin/courses");
    if (res.ok) setCourses(await res.json());
  }

  async function handleStatusChange(course: CourseRow, status: string) {
    await fetch(`/api/admin/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    startTransition(() => { refresh(); });
  }

  async function handleArchive(course: CourseRow) {
    if (!confirm(`Archive "${course.title}"? It will be removed from the catalog.`)) return;
    await fetch(`/api/admin/courses/${course.id}`, { method: "DELETE" });
    startTransition(() => { refresh(); });
  }

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
            placeholder="Search courses…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-1">
          {["all", "DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-white/20 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]?.label ?? s}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          className="ml-auto bg-[#cc3d00] text-white hover:bg-[#b33400]"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New Course
        </Button>
      </div>

      {/* table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-16 text-center">
          <BookOpen className="h-10 w-10 text-white/20" />
          <p className="text-sm text-white/50">
            {query || statusFilter !== "all" ? "No courses match your filters." : "No courses yet. Create the first one."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left">
                <th className="px-4 py-3 font-medium text-white/60">Title</th>
                <th className="px-4 py-3 font-medium text-white/60">Category</th>
                <th className="px-4 py-3 font-medium text-white/60">Status</th>
                <th className="px-4 py-3 font-medium text-white/60">Version</th>
                <th className="px-4 py-3 font-medium text-white/60">Tags</th>
                <th className="px-4 py-3 font-medium text-white/60">Updated</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((course) => {
                const statusInfo = STATUS_LABELS[course.status] ?? STATUS_LABELS.DRAFT;
                return (
                  <tr key={course.id} className="group hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#cc3d00]/20">
                          <BookOpen className="h-4 w-4 text-[#cc3d00]" />
                        </div>
                        <span className="font-medium text-white">{course.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/60">{course.category ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                        {course.status === "PUBLISHED" && <CheckCircle2 className="h-3 w-3" />}
                        {course.status === "REVIEW" && <Clock className="h-3 w-3" />}
                        {course.status === "ARCHIVED" && <Archive className="h-3 w-3" />}
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {course.activeVersion
                        ? `v${course.activeVersion.versionNumber}`
                        : course._count.versions > 0
                        ? `${course._count.versions} uploaded`
                        : "No content"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {course.tags.slice(0, 3).map((t) => (
                          <span key={t.id} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                            {t.tag}
                          </span>
                        ))}
                        {course.tags.length > 3 && (
                          <span className="text-xs text-white/40">+{course.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {new Date(course.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#0a1628] border-white/10 text-white">
                          <DropdownMenuItem onClick={() => setEditCourse(course)}>
                            Edit details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setUploadCourse(course)}>
                            <Upload className="mr-2 h-3.5 w-3.5" />
                            Upload content
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/10" />
                          {course.status === "DRAFT" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(course, "REVIEW")}>
                              <Eye className="mr-2 h-3.5 w-3.5" />
                              Submit for review
                            </DropdownMenuItem>
                          )}
                          {course.status === "REVIEW" && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(course, "PUBLISHED")}
                              disabled={!course.activeVersion && course._count.versions === 0}
                            >
                              <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-400" />
                              Publish
                            </DropdownMenuItem>
                          )}
                          {course.status === "PUBLISHED" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(course, "DRAFT")}>
                              Unpublish to draft
                            </DropdownMenuItem>
                          )}
                          {course.status !== "ARCHIVED" && (
                            <DropdownMenuItem
                              className="text-red-400 focus:text-red-300"
                              onClick={() => handleArchive(course)}
                            >
                              <Archive className="mr-2 h-3.5 w-3.5" />
                              Archive
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* dialogs */}
      <CourseDialog
        open={createOpen || !!editCourse}
        course={editCourse}
        onClose={() => { setCreateOpen(false); setEditCourse(null); }}
        onSaved={() => { setCreateOpen(false); setEditCourse(null); refresh(); }}
      />

      {uploadCourse && (
        <UploadDialog
          open
          course={uploadCourse}
          onClose={() => setUploadCourse(null)}
          onUploaded={(version) => {
            setUploadCourse(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
