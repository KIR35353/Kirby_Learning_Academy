import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "COMPLIANCE_OFFICER"].includes(r));
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  levelLabels: z.array(z.string()).optional(),
});

const courseSkillSchema = z.object({
  courseSkills: z.array(z.object({
    courseId: z.string(),
    levelGrant: z.number().int().min(1).default(1),
  })),
});

const roleReqSchema = z.object({
  roleRequirements: z.array(z.object({
    jobTitleId: z.string(),
    requiredLevel: z.number().int().min(1).default(1),
  })),
});

// GET /api/admin/skills/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const skill = await db.skill.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      category: { select: { id: true, name: true } },
      courseSkills: { include: { course: { select: { id: true, title: true } } } },
      roleRequirements: { include: { jobTitle: { select: { id: true, name: true } } } },
      _count: { select: { userSkills: true } },
    },
  });
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(skill);
}

// PATCH /api/admin/skills/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.skill.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if ("courseSkills" in body) {
    const parsed = courseSkillSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    await db.$transaction(async (tx) => {
      await tx.courseSkill.deleteMany({ where: { skillId: id } });
      for (const cs of parsed.data.courseSkills) {
        await tx.courseSkill.create({ data: { courseId: cs.courseId, skillId: id, levelGrant: cs.levelGrant } });
      }
    });
  } else if ("roleRequirements" in body) {
    const parsed = roleReqSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    await db.$transaction(async (tx) => {
      await tx.roleSkillRequirement.deleteMany({ where: { skillId: id } });
      for (const rr of parsed.data.roleRequirements) {
        await tx.roleSkillRequirement.create({ data: { jobTitleId: rr.jobTitleId, skillId: id, requiredLevel: rr.requiredLevel } });
      }
    });
  } else {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    await db.skill.update({ where: { id }, data: parsed.data });
  }

  const updated = await db.skill.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      courseSkills: { include: { course: { select: { id: true, title: true } } } },
      roleRequirements: { include: { jobTitle: { select: { id: true, name: true } } } },
      _count: { select: { userSkills: true } },
    },
  });
  return NextResponse.json(updated);
}

// DELETE /api/admin/skills/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.skill.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.skill.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
