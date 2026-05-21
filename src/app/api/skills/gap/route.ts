import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/skills/gap?userId=xxx — gap analysis for a user
// If userId omitted, uses the current session user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId") ?? session.user.id!;

  // Managers/admins can query any user in their tenant; employees can only query themselves
  const roles = session.user.roles ?? [];
  const isPrivileged = roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "COMPLIANCE_OFFICER", "MANAGER"].includes(r));
  if (targetUserId !== session.user.id && !isPrivileged)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch target user with job title
  const user = await db.user.findFirst({
    where: { id: targetUserId, tenantId: session.user.tenantId },
    select: {
      id: true, name: true, email: true,
      jobTitle: { select: { id: true, name: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // All skills for the tenant
  const allSkills = await db.skill.findMany({
    where: { tenantId: session.user.tenantId },
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });

  // User's current skill levels
  const userSkillMap = new Map(
    (await db.userSkill.findMany({ where: { userId: targetUserId } }))
      .map((s) => [s.skillId, s])
  );

  // Role requirements (if job title is set)
  const reqMap = new Map<string, number>();
  if (user.jobTitle) {
    const reqs = await db.roleSkillRequirement.findMany({
      where: { jobTitleId: user.jobTitle.id },
    });
    for (const r of reqs) reqMap.set(r.skillId, r.requiredLevel);
  }

  // Courses that can close gaps
  const courseSkillMap = new Map<string, { courseId: string; title: string; levelGrant: number }[]>();
  const courseSkills = await db.courseSkill.findMany({
    where: { course: { tenantId: session.user.tenantId, status: "PUBLISHED" } },
    include: { course: { select: { id: true, title: true } } },
  });
  for (const cs of courseSkills) {
    const list = courseSkillMap.get(cs.skillId) ?? [];
    list.push({ courseId: cs.courseId, title: cs.course.title, levelGrant: cs.levelGrant });
    courseSkillMap.set(cs.skillId, list);
  }

  const matrix = allSkills.map((skill) => {
    const achieved = userSkillMap.get(skill.id);
    const required = reqMap.get(skill.id) ?? null;
    const achievedLevel = achieved?.level ?? 0;
    const gap = required != null ? Math.max(0, required - achievedLevel) : 0;
    const recommendations = gap > 0
      ? (courseSkillMap.get(skill.id) ?? []).filter((c) => c.levelGrant >= achievedLevel + 1)
      : [];

    return {
      skillId: skill.id,
      skillName: skill.name,
      category: skill.category,
      levelLabels: skill.levelLabels,
      achievedLevel,
      requiredLevel: required,
      gap,
      source: achieved?.source ?? null,
      grantedAt: achieved?.grantedAt ?? null,
      recommendations,
    };
  });

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, jobTitle: user.jobTitle },
    matrix,
    summary: {
      total: allSkills.length,
      met: matrix.filter((m) => m.requiredLevel != null && m.achievedLevel >= (m.requiredLevel ?? 0)).length,
      gaps: matrix.filter((m) => m.gap > 0).length,
      unassessed: matrix.filter((m) => m.requiredLevel == null).length,
    },
  });
}
