import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { indexCourse, deindexCourse } from "@/lib/meili";
import { listObjects, deleteObject } from "@/lib/s3";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  targetAudience: z.string().optional(),
  complianceTags: z.array(z.string()).optional(),
  isContractorVisible: z.boolean().optional(),
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]).optional(),
  activeVersionId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

function requireAdmin(session: Session | null): boolean {
  if (!session?.user) return false;
  const roles = session.user.roles ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN") || roles.includes("INSTRUCTOR");
}

function isSuperAdmin(session: Session): boolean {
  const roles = session.user.roles ?? [];
  return roles.includes("SUPER_ADMIN");
}

// GET /api/admin/courses/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !requireAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const course = await db.course.findFirst({
    where: {
      id,
      ...(isSuperAdmin(session)
        ? {}
        : { courseTenants: { some: { tenantId: session.user.tenantId } } }),
    },
    include: {
      tags: true,
      languages: true,
      courseTenants: { select: { tenantId: true } },
      activeVersion: true,
      versions: {
        include: { uploadedBy: { select: { name: true, email: true } } },
        orderBy: { versionNumber: "desc" },
      },
    },
  });

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(course);
}

// PATCH /api/admin/courses/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !requireAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.course.findFirst({
    where: {
      id,
      ...(isSuperAdmin(session)
        ? {}
        : { courseTenants: { some: { tenantId: session.user.tenantId } } }),
    },
    include: { courseTenants: { select: { tenantId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { tags, ...data } = parsed.data;

  const course = await db.course.update({
    where: { id },
    data: {
      ...data,
      ...(data.status === "ARCHIVED" ? { archivedAt: new Date() } : {}),
      ...(data.status !== "ARCHIVED" && existing.status === "ARCHIVED"
        ? { archivedAt: null }
        : {}),
      ...(data.status === "PUBLISHED" && !existing.archivedAt
        ? { archivedAt: null }
        : {}),
      ...(tags !== undefined
        ? {
            tags: {
              deleteMany: {},
              create: tags.map((tag) => ({ tag })),
            },
          }
        : {}),
    },
    include: {
      tags: true,
      languages: true,
      activeVersion: true,
      courseTenants: { select: { tenantId: true } },
    },
  });

  // Sync to Meilisearch when publishing or re-publishing
  if (course.status === "PUBLISHED") {
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
      publishedAt: new Date().toISOString(),
    }).catch(() => {
      // Non-fatal: Meilisearch may be unavailable in some envs
    });
  } else if (course.status === "ARCHIVED") {
    await deindexCourse(course.id).catch(() => {});
  }

  return NextResponse.json(course);
}

// DELETE /api/admin/courses/[id]
// Default: soft-delete (archive). Add ?permanent=true for hard delete (SUPER_ADMIN only).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  const canDelete = roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN");
  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.course.findFirst({
    where: {
      id,
      ...(isSuperAdmin(session)
        ? {}
        : { courseTenants: { some: { tenantId: session.user.tenantId } } }),
    },
    include: { versions: { select: { s3Prefix: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const permanent = req.nextUrl.searchParams.get("permanent") === "true";

  if (permanent) {
    // Hard delete — SUPER_ADMIN only
    if (!roles.includes("SUPER_ADMIN")) {
      return NextResponse.json({ error: "Permanent delete requires SUPER_ADMIN" }, { status: 403 });
    }

    // 1. Remove from search index
    await deindexCourse(id).catch(() => {});

    // 2. Cascade-delete all DB dependants (order matters: stats → enrollments → rest)
    const enrollmentIds = (
      await db.enrollment.findMany({ where: { courseId: id }, select: { id: true } })
    ).map((e) => e.id);

    await db.courseCompletionStats.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
    await db.enrollment.deleteMany({ where: { courseId: id } });
    await db.courseCompletionHistory.deleteMany({ where: { courseId: id } });
    await db.learningPathCourse.deleteMany({ where: { courseId: id } });
    await db.courseSkill.deleteMany({ where: { courseId: id } });
    await db.courseRating.deleteMany({ where: { courseId: id } });
    await db.forumCategory.deleteMany({ where: { courseId: id } }); // cascades threads + posts
    await db.standaloneAssessment.updateMany({
      where: { remediationCourseId: id },
      data:  { remediationCourseId: null },
    });
    await db.certification.updateMany({
      where: { renewalCourseId: id },
      data:  { renewalCourseId: null },
    });

    // 3. Delete the course record (cascades CourseVersion, CourseTag, CourseLanguage)
    await db.course.delete({ where: { id } });

    // 4. Delete S3 files for every version (non-fatal)
    for (const v of existing.versions) {
      const keys = await listObjects(v.s3Prefix).catch(() => [] as string[]);
      await Promise.allSettled(keys.map((k) => deleteObject(k)));
    }

    return new NextResponse(null, { status: 204 });
  }

  // Soft delete — archive
  await db.course.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  await deindexCourse(id).catch(() => {});

  return new NextResponse(null, { status: 204 });
}
