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
  pathIds: z.array(z.string()).default([]),
});

// GET /api/admin/curricula
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const curricula = await db.curriculum.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      paths: {
        orderBy: { order: "asc" },
        include: {
          learningPath: {
            include: {
              courses: { select: { id: true } },
            },
          },
        },
      },
      _count: { select: { assignments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(curricula);
}

// POST /api/admin/curricula
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { title, description, isActive, pathIds } = parsed.data;

  const curriculum = await db.curriculum.create({
    data: {
      tenantId: session.user.tenantId,
      title,
      description,
      isActive,
      paths: {
        create: pathIds.map((learningPathId, i) => ({ learningPathId, order: i })),
      },
    },
    include: { paths: { include: { learningPath: true } } },
  });

  return NextResponse.json(curriculum, { status: 201 });
}
