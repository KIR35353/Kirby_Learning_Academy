import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";

function canEndorse(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "COMPLIANCE_OFFICER", "MANAGER"].includes(r));
}

const endorseSchema = z.object({
  userId: z.string(),
  skillId: z.string(),
  level: z.number().int().min(1),
  notes: z.string().optional(),
});

// POST /api/admin/skills/endorse — manager manually sets a user's skill level
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !canEndorse(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = endorseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify skill and user belong to the same tenant
  const [skill, user] = await Promise.all([
    db.skill.findFirst({ where: { id: parsed.data.skillId, tenantId: session.user.tenantId } }),
    db.user.findFirst({ where: { id: parsed.data.userId, tenantId: session.user.tenantId } }),
  ]);
  if (!skill) return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const userSkill = await db.userSkill.upsert({
    where: { userId_skillId: { userId: parsed.data.userId, skillId: parsed.data.skillId } },
    update: {
      level: parsed.data.level,
      source: "manual",
      endorsedById: session.user.id,
      notes: parsed.data.notes ?? null,
      sourceId: null,
    },
    create: {
      userId: parsed.data.userId,
      skillId: parsed.data.skillId,
      level: parsed.data.level,
      source: "manual",
      endorsedById: session.user.id,
      notes: parsed.data.notes ?? null,
    },
  });
  return NextResponse.json(userSkill, { status: 201 });
}
