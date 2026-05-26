import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "COMPLIANCE_OFFICER"].includes(r));
}

const categorySchema = z.object({
  name: z.string().min(1).max(100),
});

const skillSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  levelLabels: z.array(z.string()).default([]),
});

// GET /api/admin/skills — list all skills (with categories)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view");

  if (view === "categories") {
    const cats = await db.skillCategory.findMany({
      where: { tenantId: session.user.tenantId },
      include: { _count: { select: { skills: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(cats);
  }

  const skills = await db.skill.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { userSkills: true, roleRequirements: true, courseSkills: true } },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  return NextResponse.json(skills);
}

// POST /api/admin/skills — create skill or category
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  if (body.type === "category") {
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const cat = await db.skillCategory.create({
      data: { tenantId: session.user.tenantId!, name: parsed.data.name },
    });
    return NextResponse.json(cat, { status: 201 });
  }

  const parsed = skillSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const skill = await db.skill.create({
    data: {
      tenantId: session.user.tenantId!,
      name: parsed.data.name,
      description: parsed.data.description,
      categoryId: parsed.data.categoryId ?? null,
      levelLabels: parsed.data.levelLabels,
    },
    include: {
      category: { select: { id: true, name: true } },
      courseSkills: { include: { course: { select: { id: true, title: true } } } },
      roleRequirements: { include: { jobTitle: { select: { id: true, name: true } } } },
      _count: { select: { userSkills: true } },
    },
  });
  return NextResponse.json(skill, { status: 201 });
}
