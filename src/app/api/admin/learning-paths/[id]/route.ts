import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN") || roles.includes("INSTRUCTOR");
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const coursesSchema = z.object({
  // ordered list of { courseId, prerequisiteCourseId? }
  courses: z.array(
    z.object({
      courseId: z.string(),
      isRequired: z.boolean().default(true),
      prerequisiteCourseId: z.string().nullable().optional(),
    })
  ),
});

// GET /api/admin/learning-paths/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const path = await db.learningPath.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      courses: {
        orderBy: { order: "asc" },
        include: { course: { select: { id: true, title: true, category: true, status: true, duration: true } } },
      },
    },
  });

  if (!path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(path);
}

// PATCH /api/admin/learning-paths/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.learningPath.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  // Check if this is a courses update or a metadata update
  if ("courses" in body) {
    const parsed = coursesSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    await db.$transaction([
      db.learningPathCourse.deleteMany({ where: { learningPathId: id } }),
      db.learningPathCourse.createMany({
        data: parsed.data.courses.map((c, i) => ({
          learningPathId: id,
          courseId: c.courseId,
          order: i,
          isRequired: c.isRequired,
          prerequisiteCourseId: c.prerequisiteCourseId ?? null,
        })),
      }),
    ]);
  } else {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    await db.learningPath.update({ where: { id }, data: parsed.data });
  }

  const updated = await db.learningPath.findUnique({
    where: { id },
    include: { courses: { orderBy: { order: "asc" }, include: { course: true } } },
  });
  return NextResponse.json(updated);
}

// DELETE /api/admin/learning-paths/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.learningPath.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.learningPath.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
