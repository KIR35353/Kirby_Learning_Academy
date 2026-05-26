"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  CalendarDays,
  LayoutGrid,
  List,
} from "lucide-react";

interface EnrollmentRow {
  id: string;
  status: string;
  score: number | null;
  passed: boolean | null;
  dueDate: Date | string | null;
  selfEnrolled: boolean;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  attempts: number;
  course: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    duration: number | null;
    thumbnailUrl: string | null;
    tags: { id: string; tag: string }[];
    activeVersion: { versionNumber: number } | null;
  };
}

const STATUS_CONFIG = {
  NOT_STARTED: { label: "Not Started", icon: BookOpen,      className: "text-white/50 bg-white/10" },
  IN_PROGRESS: { label: "In Progress", icon: Clock,         className: "text-amber-300 bg-amber-900/40" },
  PASSED:      { label: "Passed",      icon: CheckCircle2,  className: "text-emerald-300 bg-emerald-900/40" },
  FAILED:      { label: "Failed",      icon: XCircle,       className: "text-red-300 bg-red-900/40" },
  COMPLETED:   { label: "Completed",   icon: CheckCircle2,  className: "text-emerald-300 bg-emerald-900/40" },
  EXPIRED:     { label: "Expired",     icon: AlertCircle,   className: "text-zinc-400 bg-zinc-800" },
} as const;

const TABS = ["All", "In Progress", "Not Started", "Passed", "Failed"] as const;
type Tab = (typeof TABS)[number];
type ViewMode = "grid" | "list";

function tabFilter(tab: Tab, status: string): boolean {
  if (tab === "All") return true;
  if (tab === "In Progress") return status === "IN_PROGRESS";
  if (tab === "Not Started") return status === "NOT_STARTED";
  if (tab === "Passed") return status === "PASSED" || status === "COMPLETED";
  if (tab === "Failed") return status === "FAILED";
  return true;
}

function actionLabel(status: string) {
  if (status === "NOT_STARTED") return "Start";
  if (status === "IN_PROGRESS") return "Resume";
  if (status === "PASSED" || status === "COMPLETED") return "Review";
  return "Retake";
}

function CourseThumbnail({ url, title, size }: { url: string | null; title: string; size: "card" | "row" }) {
  if (url) {
    return (
      <div className={`relative shrink-0 overflow-hidden ${size === "card" ? "h-24 w-full rounded-t-xl" : "h-9 w-9 rounded-lg"}`}>
        <Image src={url} alt={title} fill className="object-cover" />
      </div>
    );
  }
  if (size === "card") {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded-t-xl bg-gradient-to-br from-[#001245] to-[#0a1628]">
        <BookOpen className="h-8 w-8 text-white/15" />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#cc3d00]/20">
      <BookOpen className="h-4 w-4 text-[#cc3d00]" />
    </div>
  );
}

export function MyCoursesClient({ initialEnrollments }: { initialEnrollments: EnrollmentRow[] }) {
  const router = useRouter();
  const [tab, setTab]   = useState<Tab>("All");
  const [view, setView] = useState<ViewMode>("grid");
  const [enrollments]   = useState(initialEnrollments);

  useEffect(() => {
    const stored = localStorage.getItem("my-courses-view") as ViewMode | null;
    if (stored === "list" || stored === "grid") setView(stored);
  }, []);

  const handleViewChange = (v: ViewMode) => {
    setView(v);
    localStorage.setItem("my-courses-view", v);
  };

  const filtered = enrollments.filter((e) => tabFilter(tab, e.status));

  const dueSoon = enrollments.filter((e) => {
    if (!e.dueDate || e.status === "PASSED" || e.status === "COMPLETED") return false;
    const days = (new Date(e.dueDate).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 7;
  });

  return (
    <div className="space-y-6">
      {/* Due soon banner */}
      {dueSoon.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <CalendarDays className="h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-300">
            <span className="font-semibold">{dueSoon.length} course{dueSoon.length > 1 ? "s" : ""}</span>{" "}
            due within the next 7 days:{" "}
            {dueSoon.map((e) => e.course.title).join(", ")}
          </p>
        </div>
      )}

      {/* tabs + view toggle */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex gap-1 border-b border-white/10 pb-1">
          {TABS.map((t) => {
            const count = enrollments.filter((e) => tabFilter(t, e.status)).length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-t px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t
                    ? "border-b-2 border-[#cc3d00] text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {t}
                {t !== "All" && count > 0 && (
                  <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* view toggle */}
        <div className="mb-1 flex rounded-lg border border-white/10 p-0.5">
          <button
            onClick={() => handleViewChange("grid")}
            className={`rounded-md p-1.5 transition-colors ${view === "grid" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"}`}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleViewChange("list")}
            className={`rounded-md p-1.5 transition-colors ${view === "list" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"}`}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-16 text-center">
          <BookOpen className="h-10 w-10 text-white/20" />
          <p className="text-sm text-white/50">
            {tab === "All" ? "You are not enrolled in any courses." : `No ${tab.toLowerCase()} courses.`}
          </p>
          {tab === "All" && (
            <Button
              size="sm"
              className="mt-2 bg-[#cc3d00] text-white hover:bg-[#b33400]"
              onClick={() => router.push("/catalog")}
            >
              Browse Catalog
            </Button>
          )}
        </div>
      ) : view === "grid" ? (
        /* ── Grid view ──────────────────────────────────────────────────────── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((enrollment) => {
            const cfg = STATUS_CONFIG[enrollment.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.NOT_STARTED;
            const Icon = cfg.icon;
            const isOverdue =
              enrollment.dueDate &&
              new Date(enrollment.dueDate) < new Date() &&
              enrollment.status !== "PASSED" &&
              enrollment.status !== "COMPLETED";

            return (
              <div
                key={enrollment.id}
                className="flex flex-col rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 transition-colors"
              >
                <CourseThumbnail url={enrollment.course.thumbnailUrl} title={enrollment.course.title} size="card" />

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-medium text-white leading-snug">
                      {enrollment.course.title}
                    </h3>
                    <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </div>

                  {enrollment.course.category && (
                    <p className="text-xs text-white/40">{enrollment.course.category}</p>
                  )}

                  {enrollment.score !== null && (
                    <p className="text-xs text-white/60">
                      Score: <span className="font-medium text-white">{Math.round(enrollment.score)}%</span>
                    </p>
                  )}

                  {enrollment.dueDate && (
                    <p className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-400" : "text-white/40"}`}>
                      <CalendarDays className="h-3 w-3" />
                      Due {new Date(enrollment.dueDate).toLocaleDateString()}
                      {isOverdue && " (overdue)"}
                    </p>
                  )}

                  {enrollment.attempts > 0 && (
                    <p className="text-xs text-white/30">
                      {enrollment.attempts} attempt{enrollment.attempts > 1 ? "s" : ""}
                      {enrollment.completedAt && ` · Completed ${new Date(enrollment.completedAt).toLocaleDateString()}`}
                    </p>
                  )}

                  <Button
                    size="sm"
                    className="mt-auto w-full bg-[#cc3d00] text-white hover:bg-[#b33400] text-xs"
                    onClick={() => router.push(`/courses/${enrollment.id}/launch`)}
                  >
                    <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                    {actionLabel(enrollment.status)}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── List view ──────────────────────────────────────────────────────── */
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left">
                <th className="px-4 py-3 font-medium text-white/60">Course</th>
                <th className="hidden px-4 py-3 font-medium text-white/60 sm:table-cell">Category</th>
                <th className="px-4 py-3 font-medium text-white/60">Status</th>
                <th className="hidden px-4 py-3 font-medium text-white/60 md:table-cell">Score</th>
                <th className="hidden px-4 py-3 font-medium text-white/60 lg:table-cell">Due Date</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((enrollment) => {
                const cfg = STATUS_CONFIG[enrollment.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.NOT_STARTED;
                const Icon = cfg.icon;
                const isOverdue =
                  enrollment.dueDate &&
                  new Date(enrollment.dueDate) < new Date() &&
                  enrollment.status !== "PASSED" &&
                  enrollment.status !== "COMPLETED";

                return (
                  <tr key={enrollment.id} className="group hover:bg-white/5 transition-colors">
                    {/* course */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CourseThumbnail url={enrollment.course.thumbnailUrl} title={enrollment.course.title} size="row" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">{enrollment.course.title}</p>
                          {enrollment.course.duration && (
                            <p className="text-xs text-white/40">{enrollment.course.duration} min</p>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* category */}
                    <td className="hidden px-4 py-3 text-white/50 sm:table-cell">
                      {enrollment.course.category ?? "—"}
                    </td>
                    {/* status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>
                    {/* score */}
                    <td className="hidden px-4 py-3 text-white/60 md:table-cell">
                      {enrollment.score !== null
                        ? <span className={enrollment.passed ? "text-emerald-400" : "text-red-400"}>{Math.round(enrollment.score)}%</span>
                        : <span className="text-white/25">—</span>}
                    </td>
                    {/* due date */}
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {enrollment.dueDate ? (
                        <span className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-400" : "text-white/40"}`}>
                          <CalendarDays className="h-3 w-3" />
                          {new Date(enrollment.dueDate).toLocaleDateString()}
                          {isOverdue && " ⚠"}
                        </span>
                      ) : (
                        <span className="text-xs text-white/25">—</span>
                      )}
                    </td>
                    {/* action */}
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        className="bg-[#cc3d00] text-white hover:bg-[#b33400] text-xs h-7 px-3"
                        onClick={() => router.push(`/courses/${enrollment.id}/launch`)}
                      >
                        <PlayCircle className="mr-1 h-3 w-3" />
                        {actionLabel(enrollment.status)}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


