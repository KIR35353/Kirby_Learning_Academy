import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER", "MANAGER"].includes(r));
}

// GET /api/reports/course-effectiveness
// Avg score, completion rate, pass rate per course
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId") ?? undefined;

  const courses = await db.course.findMany({
    where: { tenantId: session.user.tenantId, ...(courseId ? { id: courseId } : {}) },
    select: {
      id: true, title: true, status: true,
      enrollments: {
        select: { status: true, score: true, passed: true },
      },
    },
    orderBy: { title: "asc" },
  });

  const results = courses.map((c) => {
    const total = c.enrollments.length;
    const completed = c.enrollments.filter((e) => ["PASSED", "FAILED", "COMPLETED"].includes(e.status)).length;
    const passed = c.enrollments.filter((e) => e.passed === true).length;
    const scored = c.enrollments.filter((e) => e.score !== null);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((a, e) => a + (e.score ?? 0), 0) / scored.length * 10) / 10
      : null;
    return {
      id: c.id, title: c.title, status: c.status,
      totalEnrollments: total,
      completionRate: total > 0 ? Math.round(completed / total * 100) : 0,
      passRate: completed > 0 ? Math.round(passed / completed * 100) : 0,
      avgScore,
    };
  });

  return NextResponse.json(results);
}
