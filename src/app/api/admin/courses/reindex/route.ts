import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { initCourseIndex, indexCourse } from "@/lib/meili";

/**
 * POST /api/admin/courses/reindex
 * Rebuilds the Meilisearch courses index from the database.
 * Only SUPER_ADMIN or TENANT_ADMIN may call this.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const isSuperAdmin = roles.includes("SUPER_ADMIN");

  // Ensure index settings are correct
  await initCourseIndex();

  const courses = await db.course.findMany({
    where: {
      status: "PUBLISHED",
      ...(isSuperAdmin
        ? {}
        : { courseTenants: { some: { tenantId: session.user.tenantId } } }),
    },
    include: { tags: true, courseTenants: { select: { tenantId: true } } },
  });

  let indexed = 0;
  for (const course of courses) {
    await indexCourse({
      id: course.id,
      tenantIds: course.courseTenants.map((ct) => ct.tenantId),
      title: course.title,
      description: course.description,
      category: course.category,
      tags: course.tags.map((t) => t.tag),
      objectives: course.objectives,
      targetAudience: course.targetAudience,
      duration: course.duration,
      thumbnailUrl: course.thumbnailUrl,
      status: course.status,
      publishedAt: course.updatedAt.toISOString(),
    });
    indexed++;
  }

  return NextResponse.json({ indexed, message: `Reindexed ${indexed} published courses` });
}
