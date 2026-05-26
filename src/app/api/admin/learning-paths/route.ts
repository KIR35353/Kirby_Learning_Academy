import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN") || roles.includes("INSTRUCTOR");
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  courses: z.array(
    z.object({
      courseId: z.string(),
      isRequired: z.boolean().default(true),
      prerequisiteCourseId: z.string().nullable().optional(),
    })
  ).default([]),
});

// GET /api/admin/learning-paths
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const paths = await db.learningPath.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      courses: {
        orderBy: { order: "asc" },
        include: { course: { select: { id: true, title: true, category: true, status: true } } },
      },
      _count: { select: { curricula: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(paths);
}

// POST /api/admin/learning-paths
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { title, description, isActive, courses } = parsed.data;

  const path = await db.learningPath.create({
    data: {
      tenantId: session.user.tenantId,
      title,
      description,
      isActive,
      courses: {
        create: courses.map((c, i) => ({
          courseId: c.courseId,
          order: i,
          isRequired: c.isRequired,
          prerequisiteCourseId: c.prerequisiteCourseId ?? null,
        })),
      },
    },
    include: {
      courses: { orderBy: { order: "asc" }, include: { course: true } },
      _count: { select: { curricula: true } },
    },
  });

  return NextResponse.json(path, { status: 201 });
}
