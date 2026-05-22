"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, Clock, Users, Loader2, CheckCircle2, PlayCircle, LayoutGrid, List } from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-debounce";

type ViewMode = "grid" | "details";

interface CourseHit {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  duration: number | null;
  thumbnailUrl: string | null;
  targetAudience: string | null;
  publishedAt: string | null;
}

interface EnrollmentMap {
  [courseId: string]: { id: string; status: string };
}

interface CatalogResult {
  hits: CourseHit[];
  total: number;
  page: number;
  limit: number;
  fallback?: boolean;
}

const CATEGORIES = [
  "All",
  "Safety & Compliance",
  "OSHA",
  "Maritime Operations",
  "Environmental",
  "Leadership",
  "Technical Skills",
  "Onboarding",
  "HR & Policy",
];

export function CatalogClient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [result, setResult] = useState<CatalogResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<EnrollmentMap>({});
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("grid");
  const debouncedQuery = useDebounce(query, 300);

  // Restore persisted view preference after hydration
  useEffect(() => {
    const stored = localStorage.getItem("catalog-view") as ViewMode | null;
    if (stored === "details" || stored === "grid") setView(stored);
  }, []);

  const handleViewChange = (v: ViewMode) => {
    setView(v);
    localStorage.setItem("catalog-view", v);
  };

  // Load current user's enrollments once
  useEffect(() => {
    fetch("/api/enrollments")
      .then((r) => r.json())
      .then((data: Array<{ id: string; courseId: string; status: string }>) => {
        const map: EnrollmentMap = {};
        for (const e of data) map[e.courseId] = { id: e.id, status: e.status };
        setEnrollments(map);
      })
      .catch(() => {});
  }, []);

  const fetchCourses = useCallback(async (q: string, cat: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, limit: "24" });
      if (cat !== "All") params.set("category", cat);
      const res = await fetch(`/api/courses?${params}`);
      if (res.ok) setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses(debouncedQuery, category);
  }, [debouncedQuery, category, fetchCourses]);

  return (
    <div className="space-y-6">
      {/* search bar + view toggle */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
          <Input
            className="pl-12 h-12 text-base bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl"
            placeholder="Search courses by title, topic, or keyword…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-white/30" />
          )}
        </div>
        {/* view toggle */}
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-1.5">
          <button
            title="Grid view"
            onClick={() => handleViewChange("grid")}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              view === "grid" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            title="Details view"
            onClick={() => handleViewChange("details")}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              view === "details" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* category pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              category === cat
                ? "bg-[#cc3d00] text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* results count */}
      {result && (
        <p className="text-sm text-white/40">
          {result.total} course{result.total !== 1 ? "s" : ""}
          {query ? ` for "${query}"` : ""}
          {result.fallback ? " (search unavailable — showing cached results)" : ""}
        </p>
      )}

      {result?.hits.length === 0 && !loading && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-16 text-center">
          <BookOpen className="h-10 w-10 text-white/20" />
          <p className="text-sm text-white/50">No courses found.</p>
        </div>
      )}

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result?.hits.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              enrollment={enrollments[course.id]}
              enrolling={enrolling === course.id}
              onEnroll={async () => {
                setEnrolling(course.id);
                try {
                  const res = await fetch("/api/enrollments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ courseId: course.id }),
                  });
                  if (res.ok) {
                    const e = await res.json();
                    setEnrollments((prev) => ({ ...prev, [course.id]: { id: e.id, status: e.status } }));
                  }
                } finally {
                  setEnrolling(null);
                }
              }}
              onLaunch={(enrollmentId) => router.push(`/courses/${enrollmentId}/launch`)}
            />
          ))}
        </div>
      ) : (
        <CourseTable
          hits={result?.hits ?? []}
          enrollments={enrollments}
          enrolling={enrolling}
          onEnroll={async (courseId) => {
            setEnrolling(courseId);
            try {
              const res = await fetch("/api/enrollments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId }),
              });
              if (res.ok) {
                const e = await res.json();
                setEnrollments((prev) => ({ ...prev, [courseId]: { id: e.id, status: e.status } }));
              }
            } finally {
              setEnrolling(null);
            }
          }}
          onLaunch={(enrollmentId) => router.push(`/courses/${enrollmentId}/launch`)}
        />
      )}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PASSED:       { label: "Passed",      className: "bg-emerald-900/60 text-emerald-300" },
  FAILED:       { label: "Failed",      className: "bg-red-900/40 text-red-400" },
  IN_PROGRESS:  { label: "In Progress", className: "bg-amber-900/60 text-amber-300" },
  NOT_STARTED:  { label: "Enrolled",    className: "bg-blue-900/60 text-blue-300" },
  COMPLETED:    { label: "Completed",   className: "bg-emerald-900/60 text-emerald-300" },
  EXPIRED:      { label: "Expired",     className: "bg-zinc-700 text-zinc-300" },
};

function actionLabel(status: string) {
  return status === "NOT_STARTED" ? "Start" :
         status === "IN_PROGRESS" ? "Resume" :
         status === "PASSED"      ? "Review" : "Retake";
}

// ── Details / list view ───────────────────────────────────────────────────────

function CourseTable({
  hits,
  enrollments,
  enrolling,
  onEnroll,
  onLaunch,
}: {
  hits: CourseHit[];
  enrollments: EnrollmentMap;
  enrolling: string | null;
  onEnroll: (courseId: string) => void;
  onLaunch: (enrollmentId: string) => void;
}) {
  if (hits.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5 text-left">
            <th className="w-12 px-3 py-3" />
            <th className="px-4 py-3 font-medium text-white/60">Title</th>
            <th className="hidden px-4 py-3 font-medium text-white/60 md:table-cell">Category</th>
            <th className="hidden px-4 py-3 font-medium text-white/60 lg:table-cell">Duration</th>
            <th className="hidden px-4 py-3 font-medium text-white/60 xl:table-cell">Audience</th>
            <th className="hidden px-4 py-3 font-medium text-white/60 lg:table-cell">Tags</th>
            <th className="px-4 py-3 font-medium text-white/60">Status</th>
            <th className="w-28 px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {hits.map((course) => {
            const enrollment = enrollments[course.id];
            const badge = enrollment ? STATUS_BADGE[enrollment.status] : null;
            return (
              <tr key={course.id} className="group hover:bg-white/5 transition-colors">
                {/* thumbnail */}
                <td className="px-3 py-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#001245] to-[#0a1628]">
                    {course.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-white/20" />
                    )}
                  </div>
                </td>
                {/* title + description */}
                <td className="px-4 py-2">
                  <div className="font-medium text-white leading-snug">{course.title}</div>
                  {course.description && (
                    <div className="line-clamp-1 text-xs text-white/40 mt-0.5">{course.description}</div>
                  )}
                </td>
                {/* category */}
                <td className="hidden px-4 py-2 text-white/50 md:table-cell">
                  {course.category ?? "—"}
                </td>
                {/* duration */}
                <td className="hidden px-4 py-2 lg:table-cell">
                  {course.duration ? (
                    <span className="flex items-center gap-1 text-white/50">
                      <Clock className="h-3 w-3" />
                      {course.duration} min
                    </span>
                  ) : (
                    <span className="text-white/25">—</span>
                  )}
                </td>
                {/* audience */}
                <td className="hidden px-4 py-2 xl:table-cell">
                  {course.targetAudience ? (
                    <span className="flex items-center gap-1 text-white/50">
                      <Users className="h-3 w-3 shrink-0" />
                      <span className="line-clamp-1">{course.targetAudience}</span>
                    </span>
                  ) : (
                    <span className="text-white/25">—</span>
                  )}
                </td>
                {/* tags */}
                <td className="hidden px-4 py-2 lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {course.tags?.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                        {tag}
                      </span>
                    ))}
                    {(course.tags?.length ?? 0) > 3 && (
                      <span className="text-[10px] text-white/30">+{course.tags.length - 3}</span>
                    )}
                  </div>
                </td>
                {/* enrollment status */}
                <td className="px-4 py-2">
                  {badge ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                      {enrollment?.status === "PASSED" && <CheckCircle2 className="h-3 w-3" />}
                      {badge.label}
                    </span>
                  ) : (
                    <span className="text-xs text-white/25">—</span>
                  )}
                </td>
                {/* action */}
                <td className="px-4 py-2">
                  {enrollment ? (
                    <Button
                      size="sm"
                      className="bg-[#cc3d00] text-white hover:bg-[#b33400] text-xs h-7 px-3"
                      onClick={() => onLaunch(enrollment.id)}
                    >
                      <PlayCircle className="mr-1 h-3 w-3" />
                      {actionLabel(enrollment.status)}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={enrolling === course.id}
                      className="bg-white/10 text-white hover:bg-white/20 text-xs h-7 px-3"
                      onClick={() => onEnroll(course.id)}
                    >
                      {enrolling === course.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enroll"}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Grid / card view ──────────────────────────────────────────────────────────

function CourseCard({
  course,
  enrollment,
  enrolling,
  onEnroll,
  onLaunch,
}: {
  course: CourseHit;
  enrollment?: { id: string; status: string };
  enrolling: boolean;
  onEnroll: () => void;
  onLaunch: (id: string) => void;
}) {
  const statusBadge = enrollment ? STATUS_BADGE[enrollment.status] : null;

  return (
    <div className="group flex flex-col rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 transition-colors">
      {/* thumbnail */}
      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-[#001245] to-[#0a1628]">
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnailUrl} alt={course.title} className="h-full w-full object-cover" />
        ) : (
          <BookOpen className="h-10 w-10 text-white/20" />
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {course.category && (
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-xs text-white/70">
              {course.category}
            </span>
          )}
          {statusBadge && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          )}
        </div>
        {enrollment?.status === "PASSED" && (
          <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-emerald-400" />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-medium text-white leading-snug">{course.title}</h3>

        {course.description && (
          <p className="line-clamp-2 text-xs text-white/50">{course.description}</p>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          {course.duration && (
            <span className="flex items-center gap-1 text-xs text-white/40">
              <Clock className="h-3 w-3" />
              {course.duration} min
            </span>
          )}
          {course.targetAudience && (
            <span className="flex items-center gap-1 text-xs text-white/40">
              <Users className="h-3 w-3" />
              {course.targetAudience}
            </span>
          )}
        </div>

        {course.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {course.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                {tag}
              </span>
            ))}
          </div>
        )}

        {enrollment ? (
          <Button
            size="sm"
            className="mt-2 w-full bg-[#cc3d00] text-white hover:bg-[#b33400] text-xs"
            onClick={() => onLaunch(enrollment.id)}
          >
            <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
            {actionLabel(enrollment.status)}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={enrolling}
            className="mt-2 w-full bg-white/10 text-white hover:bg-white/20 text-xs"
            onClick={onEnroll}
          >
            {enrolling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enroll"}
          </Button>
        )}
      </div>
    </div>
  );
}
