import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "COMPLIANCE_OFFICER", "MANAGER"].includes(r));
}

// GET /api/admin/skills/matrix?departmentId=xxx&jobTitleId=xxx
// Returns org-wide skills matrix: users × skills with achieved/required levels
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId");
  const jobTitleId = searchParams.get("jobTitleId");

  const [skills, users] = await Promise.all([
    db.skill.findMany({
      where: { tenantId: session.user.tenantId },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    db.user.findMany({
      where: {
        tenantId: session.user.tenantId,
        isActive: true,
        ...(departmentId ? { departmentId } : {}),
        ...(jobTitleId ? { jobTitleId } : {}),
      },
      select: {
        id: true, name: true, email: true,
        department: { select: { id: true, name: true } },
        jobTitle: { select: { id: true, name: true } },
        userSkills: { select: { skillId: true, level: true, source: true, grantedAt: true } },
      },
      orderBy: [{ name: "asc" }],
      take: 200, // cap for UI performance
    }),
  ]);

  // Role requirements keyed by jobTitleId
  const allReqs = await db.roleSkillRequirement.findMany({
    where: { skill: { tenantId: session.user.tenantId } },
  });
  const reqMap = new Map<string, Map<string, number>>(); // jobTitleId → skillId → requiredLevel
  for (const r of allReqs) {
    const inner = reqMap.get(r.jobTitleId) ?? new Map<string, number>();
    inner.set(r.skillId, r.requiredLevel);
    reqMap.set(r.jobTitleId, inner);
  }

  const rows = users.map((u) => {
    const skillMap = new Map(u.userSkills.map((s) => [s.skillId, s]));
    const roleReqs = u.jobTitle ? (reqMap.get(u.jobTitle.id) ?? new Map<string, number>()) : new Map<string, number>();

    const cells = skills.map((s) => {
      const achieved = skillMap.get(s.id);
      const required = roleReqs.get(s.id) ?? null;
      return {
        skillId: s.id,
        achievedLevel: achieved?.level ?? 0,
        requiredLevel: required,
        gap: required != null ? Math.max(0, required - (achieved?.level ?? 0)) : 0,
        source: achieved?.source ?? null,
      };
    });

    const gaps = cells.filter((c) => c.gap > 0).length;
    return {
      userId: u.id, name: u.name, email: u.email,
      department: u.department, jobTitle: u.jobTitle,
      cells, gaps,
    };
  });

  return NextResponse.json({ skills, rows });
}
