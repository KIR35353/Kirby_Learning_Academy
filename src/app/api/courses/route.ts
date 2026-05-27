import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { meili, COURSE_INDEX } from "@/lib/meili";

/**
 * GET /api/courses
 * Learner-facing catalog search powered by Meilisearch.
 * Falls back to Prisma when Meilisearch is unavailable.
 *
 * Query params:
 *   q        — full-text search query
 *   category — filter by category
 *   tag      — filter by tag
 *   page     — 1-based page number (default 1)
 *   limit    — results per page (default 20, max 50)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category");
  const tag = searchParams.get("tag");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const meiliFilters: string[] = [
    `tenantIds = "${session.user.tenantId}"`,
    `status = "PUBLISHED"`,
  ];
  if (category) meiliFilters.push(`category = "${category}"`);
  if (tag) meiliFilters.push(`tags = "${tag}"`);

  try {
    const result = await meili.index(COURSE_INDEX).search(q, {
      filter: meiliFilters.join(" AND "),
      limit,
      offset: (page - 1) * limit,
      sort: q ? undefined : ["publishedAt:desc"],
    });

    return NextResponse.json({
      hits: result.hits,
      total: result.estimatedTotalHits ?? result.hits.length,
      page,
      limit,
    });
  } catch {
    // Meilisearch unavailable — fall back to Prisma
    const where = {
      courseTenants: { some: { tenantId: session.user.tenantId } },
      status: "PUBLISHED" as const,
      ...(category ? { category } : {}),
      ...(tag ? { tags: { some: { tag } } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [courses, total] = await Promise.all([
      db.course.findMany({
        where,
        include: { tags: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.course.count({ where }),
    ]);

    const hits = courses.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      tags: c.tags.map((t) => t.tag),
      duration: c.duration,
      thumbnailUrl: c.thumbnailUrl,
      targetAudience: c.targetAudience,
      publishedAt: c.createdAt?.toISOString() ?? null,
    }));

    return NextResponse.json({ hits, total, page, limit, fallback: true });
  }
}
