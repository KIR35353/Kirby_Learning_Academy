import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { indexCourse } from "@/lib/meili";

const updateTenantsSchema = z.object({
  tenantIds: z.array(z.string()).min(1),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  const canView =
    roles.includes("SUPER_ADMIN") ||
    roles.includes("TENANT_ADMIN") ||
    roles.includes("INSTRUCTOR");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isSuperAdmin = roles.includes("SUPER_ADMIN");
  const { id } = await params;

  const course = await db.course.findFirst({
    where: {
      id,
      ...(isSuperAdmin
        ? {}
        : { courseTenants: { some: { tenantId: session.user.tenantId } } }),
    },
    include: {
      courseTenants: {
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    courseId: course.id,
    tenants: course.courseTenants.map((ct) => ({
      id: ct.tenant.id,
      name: ct.tenant.name,
      slug: ct.tenant.slug,
      assignedAt: ct.assignedAt,
      assignedById: ct.assignedById,
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Only SUPER_ADMIN can assign tenants" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateTenantsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tenantIds = Array.from(new Set(parsed.data.tenantIds));
  const tenantCount = await db.tenant.count({ where: { id: { in: tenantIds } } });
  if (tenantCount !== tenantIds.length) {
    return NextResponse.json({ error: "One or more tenantIds are invalid" }, { status: 400 });
  }

  const { id } = await params;
  const existing = await db.course.findUnique({ where: { id }, include: { courseTenants: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const currentTenantIds = new Set(existing.courseTenants.map((ct) => ct.tenantId));
  const nextTenantIds = new Set(tenantIds);

  const toAdd = tenantIds.filter((tenantId) => !currentTenantIds.has(tenantId));
  const toRemove = existing.courseTenants
    .filter((ct) => !nextTenantIds.has(ct.tenantId))
    .map((ct) => ct.tenantId);

  await db.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.courseTenant.deleteMany({ where: { courseId: id, tenantId: { in: toRemove } } });
    }

    if (toAdd.length > 0) {
      await tx.courseTenant.createMany({
        data: toAdd.map((tenantId) => ({
          courseId: id,
          tenantId,
          assignedById: session.user.id,
        })),
      });
    }

    await tx.course.update({ where: { id }, data: { tenantId: tenantIds[0] } });
  });

  const updated = await db.course.findUnique({
    where: { id },
    include: {
      tags: true,
      courseTenants: { select: { tenantId: true } },
    },
  });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (updated.status === "PUBLISHED") {
    await indexCourse({
      id: updated.id,
      tenantIds: updated.courseTenants.map((ct) => ct.tenantId),
      title: updated.title,
      description: updated.description,
      category: updated.category,
      tags: updated.tags.map((t) => t.tag),
      objectives: updated.objectives,
      targetAudience: updated.targetAudience,
      duration: updated.duration,
      thumbnailUrl: updated.thumbnailUrl,
      status: updated.status,
      publishedAt: updated.updatedAt.toISOString(),
    }).catch(() => {});
  }

  return NextResponse.json({
    courseId: updated.id,
    tenantIds: updated.courseTenants.map((ct) => ct.tenantId),
  });
}
