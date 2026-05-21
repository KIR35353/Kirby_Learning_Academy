"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, Clock, Users, Tag, Loader2 } from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-debounce";

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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [result, setResult] = useState<CatalogResult | null>(null);
  const [loading, setLoading] = useState(true);
  const debouncedQuery = useDebounce(query, 300);

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
      {/* search bar */}
      <div className="relative">
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

      {/* results */}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {result?.hits.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: CourseHit }) {
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
        {course.category && (
          <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white/70">
            {course.category}
          </span>
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

        <Button
          size="sm"
          className="mt-2 w-full bg-[#cc3d00]/80 text-white hover:bg-[#cc3d00] text-xs"
        >
          View Course
        </Button>
      </div>
    </div>
  );
}
