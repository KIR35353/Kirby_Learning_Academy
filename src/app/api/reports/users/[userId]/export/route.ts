import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) =>
    ["SUPER_ADMIN", "TENANT_ADMIN", "MANAGER", "COMPLIANCE_OFFICER"].includes(r),
  );
}

type EnrollmentStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "PASSED" | "FAILED" | "EXPIRED";

function toDateOrDefault(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/** Escape a CSV cell value (quote if contains comma, newline, or quote) */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

/**
 * GET /api/reports/users/[userId]/export
 *
 * Generates a CSV download of the user's performance report.
 * Sections included:
 *   1. User info & summary KPIs
 *   2. Course enrollment detail
 *   3. Assessment attempt detail
 *   4. Recent activity log
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const { searchParams } = new URL(req.url);

  const rangeEnd = toDateOrDefault(searchParams.get("endDate"), new Date());
  const defaultStart = new Date(rangeEnd);
  defaultStart.setDate(defaultStart.getDate() - 90);
  const rangeStart = toDateOrDefault(searchParams.get("startDate"), defaultStart);

  const user = await db.user.findFirst({
    where: { id: userId, tenantId: session.user.tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      department: { select: { name: true } },
      jobTitle: { select: { name: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();

  // ── Fetch all data in parallel ──────────────────────────────────────────────
  const [
    loginCount,
    failedLoginCount,
    lastSession,
    enrollments,
    assessmentAttempts,
    recentActivity,
  ] = await Promise.all([
    db.session.count({
      where: { userId, createdAt: { gte: rangeStart, lte: rangeEnd } },
    }),
    db.authEvent.count({
      where: {
        userId,
        tenantId: session.user.tenantId,
        eventType: "LOGIN_FAILED",
        createdAt: { gte: rangeStart, lte: rangeEnd },
      },
    }),
    db.session.findFirst({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.enrollment.findMany({
      where: { userId, tenantId: session.user.tenantId },
      select: {
        status: true,
        createdAt: true,
        completedAt: true,
        dueDate: true,
        course: { select: { title: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.assessmentAttempt.findMany({
      where: {
        userId,
        tenantId: session.user.tenantId,
        startedAt: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        status: true,
        score: true,
        startedAt: true,
        submittedAt: true,
        assessment: { select: { title: true } },
      },
      orderBy: { startedAt: "desc" },
    }),
    (async () => {
      const [sessions, completions, attempts] = await Promise.all([
        db.session.findMany({
          where: { userId, createdAt: { gte: rangeStart, lte: rangeEnd } },
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        db.enrollment.findMany({
          where: {
            userId,
            tenantId: session.user.tenantId,
            status: { in: ["PASSED", "COMPLETED", "FAILED"] },
            completedAt: { gte: rangeStart, lte: rangeEnd },
          },
          select: {
            status: true,
            completedAt: true,
            course: { select: { title: true } },
          },
          orderBy: { completedAt: "desc" },
          take: 50,
        }),
        db.assessmentAttempt.findMany({
          where: {
            userId,
            tenantId: session.user.tenantId,
            startedAt: { gte: rangeStart, lte: rangeEnd },
          },
          select: {
            status: true,
            score: true,
            submittedAt: true,
            startedAt: true,
            assessment: { select: { title: true } },
          },
          orderBy: { startedAt: "desc" },
          take: 50,
        }),
      ]);

      return [
        ...sessions.map((s) => ({
          type: "Login",
          description: "Successful login",
          timestamp: s.createdAt,
          result: "Success",
          score: null as number | null,
        })),
        ...completions.map((e) => ({
          type: "Course",
          description: e.course.title,
          timestamp: e.completedAt ?? new Date(0),
          result: e.status,
          score: null as number | null,
        })),
        ...attempts.map((a) => ({
          type: "Assessment",
          description: a.assessment.title,
          timestamp: a.submittedAt ?? a.startedAt,
          result: a.status,
          score: a.score,
        })),
      ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    })(),
  ]);

  // ── Build CSV ─────────────────────────────────────────────────────────────
  const lines: string[] = [];

  // Section 1: Report header and user info
  lines.push("KIRBY LEARNING ACADEMY — USER PERFORMANCE REPORT");
  lines.push(csvRow(["Generated", new Date().toISOString()]));
  lines.push(csvRow(["Date Range", `${rangeStart.toLocaleDateString()} – ${rangeEnd.toLocaleDateString()}`]));
  lines.push("");
  lines.push("USER INFORMATION");
  lines.push(csvRow(["Name", user.name ?? ""]));
  lines.push(csvRow(["Email", user.email]));
  lines.push(csvRow(["Department", user.department?.name ?? ""]));
  lines.push(csvRow(["Job Title", user.jobTitle?.name ?? ""]));
  lines.push(csvRow(["Member Since", user.createdAt.toLocaleDateString()]));
  lines.push(csvRow(["Last Login", lastSession?.createdAt?.toLocaleString() ?? "Never"]));
  lines.push("");

  // Section 2: Login summary
  lines.push("LOGIN SUMMARY (DATE RANGE)");
  lines.push(csvRow(["Metric", "Value"]));
  lines.push(csvRow(["Successful Logins", loginCount]));
  lines.push(csvRow(["Failed Login Attempts", failedLoginCount]));
  lines.push("");

  // Section 3: Course enrollment detail
  const completed = enrollments.filter((e) => e.status === "COMPLETED" || e.status === "PASSED").length;
  const inProgress = enrollments.filter((e) => e.status === "IN_PROGRESS").length;
  const failed = enrollments.filter((e) => e.status === "FAILED").length;
  const notStarted = enrollments.filter((e) => e.status === "NOT_STARTED").length;
  const overdue = enrollments.filter(
    (e) => ["NOT_STARTED", "IN_PROGRESS"].includes(e.status) && e.dueDate && e.dueDate < now,
  ).length;
  const completionRate =
    enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0;

  lines.push("COURSE SUMMARY");
  lines.push(csvRow(["Metric", "Value"]));
  lines.push(csvRow(["Total Assigned", enrollments.length]));
  lines.push(csvRow(["Completed", completed]));
  lines.push(csvRow(["In Progress", inProgress]));
  lines.push(csvRow(["Not Started", notStarted]));
  lines.push(csvRow(["Failed", failed]));
  lines.push(csvRow(["Overdue", overdue]));
  lines.push(csvRow(["Completion Rate", `${completionRate}%`]));
  lines.push("");

  lines.push("COURSE ENROLLMENT DETAIL");
  lines.push(csvRow(["Course Title", "Category", "Status", "Enrolled Date", "Due Date", "Completed Date"]));
  for (const e of enrollments) {
    lines.push(
      csvRow([
        e.course.title,
        e.course.category ?? "",
        e.status,
        e.createdAt?.toLocaleDateString() ?? "",
        e.dueDate?.toLocaleDateString() ?? "",
        e.completedAt?.toLocaleDateString() ?? "",
      ]),
    );
  }
  lines.push("");

  // Section 4: Assessment detail
  const passedAttempts = assessmentAttempts.filter((a) => a.status === "PASSED").length;
  const failedAttempts = assessmentAttempts.filter((a) => a.status === "FAILED").length;
  const totalSubmitted = passedAttempts + failedAttempts;
  const passRate = totalSubmitted > 0 ? Math.round((passedAttempts / totalSubmitted) * 100) : 0;
  const scores = assessmentAttempts.map((a) => a.score).filter((s): s is number => s !== null);
  const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;

  lines.push("ASSESSMENT SUMMARY (DATE RANGE)");
  lines.push(csvRow(["Metric", "Value"]));
  lines.push(csvRow(["Total Attempts", assessmentAttempts.length]));
  lines.push(csvRow(["Passed", passedAttempts]));
  lines.push(csvRow(["Failed", failedAttempts]));
  lines.push(csvRow(["Pass Rate", `${passRate}%`]));
  lines.push(csvRow(["Average Score", avgScore !== null ? `${avgScore}%` : "N/A"]));
  lines.push("");

  lines.push("ASSESSMENT ATTEMPT DETAIL (DATE RANGE)");
  lines.push(csvRow(["Assessment Title", "Status", "Score", "Started", "Submitted"]));
  for (const a of assessmentAttempts) {
    lines.push(
      csvRow([
        a.assessment.title,
        a.status,
        a.score !== null ? `${Math.round(a.score)}%` : "",
        a.startedAt.toLocaleString(),
        a.submittedAt?.toLocaleString() ?? "",
      ]),
    );
  }
  lines.push("");

  // Section 5: Recent activity log
  lines.push("RECENT ACTIVITY (DATE RANGE)");
  lines.push(csvRow(["Timestamp", "Type", "Description", "Result", "Score"]));
  for (const item of recentActivity) {
    lines.push(
      csvRow([
        item.timestamp.toLocaleString(),
        item.type,
        item.description,
        item.result,
        item.score !== null ? `${Math.round(item.score)}%` : "",
      ]),
    );
  }

  const csv = lines.join("\r\n");
  const safeName = (user.name ?? user.email).replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `user_report_${safeName}_${dateStr}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
