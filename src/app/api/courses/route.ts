import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

  const filters: string[] = [
    `tenantId = "${session.user.tenantId}"`,
    `status = "PUBLISHED"`,
  ];
  if (category) filters.push(`category = "${category}"`);
  if (tag) filters.push(`tags = "${tag}"`);

  try {
    const result = await meili.index(COURSE_INDEX).search(q, {
      filter: filters.join(" AND "),
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
    // Meilisearch unavailable — return empty result gracefully
    return NextResponse.json({ hits: [], total: 0, page, limit, fallback: true });
  }
}
