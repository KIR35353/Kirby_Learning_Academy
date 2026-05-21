"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, BookOpen, ChevronRight } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string | null;
  course: { id: string; title: string } | null;
  _count: { threads: number };
}

export function ForumsClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/forums/categories")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const general = categories.filter((c) => !c.course);
  const courseBased = categories.filter((c) => c.course);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-k-navy" />
        <h2 className="text-xl font-bold text-k-navy">Discussion Forums</h2>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p>No forum categories yet.</p>
        </div>
      ) : (
        <>
          {general.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">General</h3>
              <CategoryList categories={general} />
            </section>
          )}
          {courseBased.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> Course Boards
              </h3>
              <CategoryList categories={courseBased} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CategoryList({ categories }: { categories: Category[] }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
      {categories.map((cat) => (
        <Link key={cat.id} href={`/forums/${cat.id}`}
          className="flex items-center gap-4 px-5 py-4 hover:bg-accent/40 transition-colors group">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-k-navy/10 shrink-0">
            <MessageSquare className="h-5 w-5 text-k-navy" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground group-hover:text-k-navy transition-colors">{cat.name}</p>
            {cat.description && <p className="text-sm text-muted-foreground truncate">{cat.description}</p>}
            {cat.course && <p className="text-xs text-k-navy/70 mt-0.5">Course: {cat.course.title}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium text-foreground">{cat._count.threads}</p>
            <p className="text-xs text-muted-foreground">threads</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-k-navy transition-colors" />
        </Link>
      ))}
    </div>
  );
}
