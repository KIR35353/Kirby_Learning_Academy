import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { indexCourse, deindexCourse } from "@/lib/meili";
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

async function requireAdmin(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user) return false;
  const roles = session.user.roles ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN") || roles.includes("INSTRUCTOR");
}

// GET /api/admin/courses/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !requireAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const course = await db.course.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      tags: true,
      languages: true,
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
  const existing = await db.course.findFirst({ where: { id, tenantId: session.user.tenantId } });
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
    include: { tags: true, languages: true, activeVersion: true },
  });

  // Sync to Meilisearch when publishing or re-publishing
  if (course.status === "PUBLISHED") {
    await indexCourse({
      id: course.id,
      tenantId: course.tenantId,
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

// DELETE /api/admin/courses/[id] — archive (soft delete)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  const canDelete = roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN");
  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.course.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.course.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  await deindexCourse(id).catch(() => {});

  return new NextResponse(null, { status: 204 });
}
