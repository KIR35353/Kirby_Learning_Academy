import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "MANAGER"].includes(r));
}

// GET /api/reports/completions
// Training completion report with filters
// ?courseId=&departmentId=&startDate=&endDate=&status=&export=csv
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId") ?? undefined;
  const departmentId = searchParams.get("departmentId") ?? undefined;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const status = searchParams.get("status") ?? undefined;
  const exportCsv = searchParams.get("export") === "csv";
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = exportCsv ? 5000 : 50;

  const where = {
    tenantId: session.user.tenantId,
    ...(courseId ? { courseId } : {}),
    ...(departmentId ? { user: { departmentId } } : {}),
    ...(status ? { status: status as "PASSED" | "FAILED" | "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED" } : {}),
    ...(startDate || endDate ? {
      createdAt: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      },
    } : {}),
  };

  const [enrollments, total] = await Promise.all([
    db.enrollment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true, name: true, email: true,
            department: { select: { name: true } },
            jobTitle: { select: { name: true } },
          },
        },
        course: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.enrollment.count({ where }),
  ]);

  if (exportCsv) {
    const header = ["Employee", "Email", "Department", "Job Title", "Course", "Status", "Score", "Passed", "Started", "Completed", "Due Date"].join(",");
    const rows = enrollments.map((e) => [
      `"${e.user.name ?? ""}"`,
      `"${e.user.email}"`,
      `"${e.user.department?.name ?? ""}"`,
      `"${e.user.jobTitle?.name ?? ""}"`,
      `"${e.course.title}"`,
      `"${e.status}"`,
      e.score !== null ? e.score.toFixed(1) : "",
      e.passed !== null ? (e.passed ? "Yes" : "No") : "",
      `"${e.startedAt?.toISOString() ?? ""}"`,
      `"${e.completedAt?.toISOString() ?? ""}"`,
      `"${e.dueDate?.toISOString() ?? ""}"`,
    ].join(","));
    const csv = [header, ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="completions-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    data: enrollments,
    meta: { total, page, pageSize, pages: Math.ceil(total / pageSize) },
  });
}
