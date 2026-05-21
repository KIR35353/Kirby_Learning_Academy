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

const pathsSchema = z.object({
  pathIds: z.array(z.string()),
});

const assignSchema = z.object({
  roleName: z.string().optional(),
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  dueDate: z.string().optional(),
});

// GET /api/admin/curricula/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const curriculum = await db.curriculum.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      paths: {
        orderBy: { order: "asc" },
        include: {
          learningPath: {
            include: {
              courses: {
                orderBy: { order: "asc" },
                include: { course: { select: { id: true, title: true, category: true, duration: true, status: true } } },
              },
            },
          },
        },
      },
      assignments: {
        include: {
          department: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { assignedAt: "desc" },
      },
    },
  });

  if (!curriculum) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(curriculum);
}

// PATCH /api/admin/curricula/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.curriculum.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if ("pathIds" in body) {
    // Replace paths
    const parsed = pathsSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    await db.$transaction([
      db.curriculumPath.deleteMany({ where: { curriculumId: id } }),
      db.curriculumPath.createMany({
        data: parsed.data.pathIds.map((learningPathId, i) => ({ curriculumId: id, learningPathId, order: i })),
      }),
    ]);
  } else if ("assign" in body) {
    // Add an assignment
    const parsed = assignSchema.safeParse(body.assign);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const assignment = await db.curriculumAssignment.create({
      data: {
        curriculumId: id,
        tenantId: session.user.tenantId,
        roleName: parsed.data.roleName,
        departmentId: parsed.data.departmentId,
        userId: parsed.data.userId,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        assignedById: session.user.id,
      },
    });
    return NextResponse.json(assignment, { status: 201 });
  } else {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    await db.curriculum.update({ where: { id }, data: parsed.data });
  }

  const updated = await db.curriculum.findUnique({
    where: { id },
    include: {
      paths: { orderBy: { order: "asc" }, include: { learningPath: { include: { courses: { include: { course: true } } } } } },
      assignments: { include: { department: true, user: true } },
    },
  });
  return NextResponse.json(updated);
}

// DELETE /api/admin/curricula/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.curriculum.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.curriculum.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
