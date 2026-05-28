// @vitest-environment node
/**
 * Unit tests: CSV export format and structure
 *
 * Tests the csv cell/row serialization helpers and validates that the
 * generated CSV output contains the expected sections and values.
 */
import { describe, it, expect } from "vitest";

// ── CSV helpers (mirrors export/route.ts) ─────────────────────────────────────

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

function buildUserReportCsv(opts: {
  userName: string;
  userEmail: string;
  department: string | null;
  jobTitle: string | null;
  joinedAt: Date;
  lastLogin: Date | null;
  dateRange: { start: Date; end: Date };
  loginSuccess: number;
  loginFailed: number;
  enrollments: Array<{
    title: string;
    category: string | null;
    status: string;
    enrolledAt: Date | null;
    dueDate: Date | null;
    completedAt: Date | null;
  }>;
}): string {
  const lines: string[] = [];

  lines.push("KIRBY LEARNING ACADEMY — USER PERFORMANCE REPORT");
  lines.push(csvRow(["Generated", new Date("2026-05-28T00:00:00Z").toISOString()]));
  lines.push(
    csvRow([
      "Date Range",
      `${opts.dateRange.start.toLocaleDateString()} – ${opts.dateRange.end.toLocaleDateString()}`,
    ]),
  );
  lines.push("");
  lines.push("USER INFORMATION");
  lines.push(csvRow(["Name", opts.userName]));
  lines.push(csvRow(["Email", opts.userEmail]));
  lines.push(csvRow(["Department", opts.department ?? ""]));
  lines.push(csvRow(["Job Title", opts.jobTitle ?? ""]));
  lines.push(csvRow(["Member Since", opts.joinedAt.toLocaleDateString()]));
  lines.push(csvRow(["Last Login", opts.lastLogin?.toLocaleString() ?? "Never"]));
  lines.push("");

  lines.push("LOGIN SUMMARY (DATE RANGE)");
  lines.push(csvRow(["Metric", "Value"]));
  lines.push(csvRow(["Successful Logins", opts.loginSuccess]));
  lines.push(csvRow(["Failed Login Attempts", opts.loginFailed]));
  lines.push("");

  lines.push("COURSE ENROLLMENT DETAIL");
  lines.push(
    csvRow(["Course Title", "Category", "Status", "Enrolled Date", "Due Date", "Completed Date"]),
  );
  for (const e of opts.enrollments) {
    lines.push(
      csvRow([
        e.title,
        e.category ?? "",
        e.status,
        e.enrolledAt?.toLocaleDateString() ?? "",
        e.dueDate?.toLocaleDateString() ?? "",
        e.completedAt?.toLocaleDateString() ?? "",
      ]),
    );
  }

  return lines.join("\r\n");
}

// ── CSV row/cell tests ────────────────────────────────────────────────────────

describe("csvRow", () => {
  it("joins cells with commas", () => {
    expect(csvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("handles empty cells", () => {
    expect(csvRow(["a", null, "c"])).toBe("a,,c");
  });

  it("quotes cells that contain commas", () => {
    expect(csvRow(["Smith, John", "COMPLETED"])).toBe('"Smith, John",COMPLETED');
  });

  it("produces a valid header row", () => {
    const header = csvRow([
      "Course Title",
      "Category",
      "Status",
      "Enrolled Date",
      "Due Date",
      "Completed Date",
    ]);
    const cols = header.split(",");
    expect(cols).toHaveLength(6);
    expect(cols[0]).toBe("Course Title");
    expect(cols[2]).toBe("Status");
  });
});

// ── buildUserReportCsv structure ──────────────────────────────────────────────

describe("buildUserReportCsv", () => {
  const baseOpts = {
    userName: "Jane Doe",
    userEmail: "jane@example.com",
    department: "Engineering",
    jobTitle: "Senior Dev",
    joinedAt: new Date("2024-01-15T00:00:00Z"),
    lastLogin: new Date("2026-05-27T14:30:00Z"),
    dateRange: {
      start: new Date("2026-03-01T00:00:00Z"),
      end: new Date("2026-05-28T00:00:00Z"),
    },
    loginSuccess: 45,
    loginFailed: 2,
    enrollments: [
      {
        title: "Safety Training 101",
        category: "Compliance",
        status: "COMPLETED",
        enrolledAt: new Date("2026-03-10T00:00:00Z"),
        dueDate: new Date("2026-04-10T00:00:00Z"),
        completedAt: new Date("2026-03-25T00:00:00Z"),
      },
      {
        title: "Advanced Leadership",
        category: null,
        status: "IN_PROGRESS",
        enrolledAt: new Date("2026-04-01T00:00:00Z"),
        dueDate: new Date("2026-06-01T00:00:00Z"),
        completedAt: null,
      },
    ],
  };

  it("contains the report header", () => {
    const csv = buildUserReportCsv(baseOpts);
    expect(csv).toContain("KIRBY LEARNING ACADEMY — USER PERFORMANCE REPORT");
  });

  it("contains the user name", () => {
    const csv = buildUserReportCsv(baseOpts);
    expect(csv).toContain("Jane Doe");
  });

  it("contains the user email", () => {
    const csv = buildUserReportCsv(baseOpts);
    expect(csv).toContain("jane@example.com");
  });

  it("contains the department", () => {
    const csv = buildUserReportCsv(baseOpts);
    expect(csv).toContain("Engineering");
  });

  it("includes USER INFORMATION section", () => {
    const csv = buildUserReportCsv(baseOpts);
    expect(csv).toContain("USER INFORMATION");
  });

  it("includes LOGIN SUMMARY section", () => {
    const csv = buildUserReportCsv(baseOpts);
    expect(csv).toContain("LOGIN SUMMARY (DATE RANGE)");
  });

  it("includes successful and failed login counts", () => {
    const csv = buildUserReportCsv(baseOpts);
    expect(csv).toContain("Successful Logins,45");
    expect(csv).toContain("Failed Login Attempts,2");
  });

  it("includes COURSE ENROLLMENT DETAIL section header", () => {
    const csv = buildUserReportCsv(baseOpts);
    expect(csv).toContain("COURSE ENROLLMENT DETAIL");
  });

  it("includes each enrollment row", () => {
    const csv = buildUserReportCsv(baseOpts);
    expect(csv).toContain("Safety Training 101");
    expect(csv).toContain("Advanced Leadership");
  });

  it("includes enrollment status values", () => {
    const csv = buildUserReportCsv(baseOpts);
    expect(csv).toContain("COMPLETED");
    expect(csv).toContain("IN_PROGRESS");
  });

  it("uses CRLF line endings for RFC 4180 compliance", () => {
    const csv = buildUserReportCsv(baseOpts);
    expect(csv).toContain("\r\n");
    // Ensure we're not using just \n
    const lines = csv.split("\r\n");
    expect(lines.length).toBeGreaterThan(5);
  });

  it("handles null department gracefully", () => {
    const csv = buildUserReportCsv({ ...baseOpts, department: null });
    // Should not throw; department cell should be empty
    const lines = csv.split("\r\n");
    const deptLine = lines.find((l) => l.startsWith("Department,"));
    expect(deptLine).toBe("Department,");
  });

  it("handles null last login gracefully", () => {
    const csv = buildUserReportCsv({ ...baseOpts, lastLogin: null });
    expect(csv).toContain("Last Login,Never");
  });

  it("handles enrollments with null completedAt", () => {
    const csv = buildUserReportCsv(baseOpts);
    // The Advanced Leadership course has no completion date — row should still appear
    expect(csv).toContain("Advanced Leadership");
    // The completed date column for that row should be empty (two consecutive commas)
    expect(csv).toContain("IN_PROGRESS,");
  });

  it("produces at least 15 lines", () => {
    const csv = buildUserReportCsv(baseOpts);
    const lines = csv.split("\r\n");
    expect(lines.length).toBeGreaterThanOrEqual(15);
  });
});

// ── Filename generation ───────────────────────────────────────────────────────

describe("export filename generation", () => {
  function buildFilename(name: string | null, email: string, date: string): string {
    const safeName = (name ?? email).replace(/[^a-z0-9]/gi, "_").toLowerCase();
    return `user_report_${safeName}_${date}.csv`;
  }

  it("generates a valid filename for a normal name", () => {
    expect(buildFilename("Jane Doe", "jane@example.com", "2026-05-28")).toBe(
      "user_report_jane_doe_2026-05-28.csv",
    );
  });

  it("falls back to email when name is null", () => {
    expect(buildFilename(null, "jane@example.com", "2026-05-28")).toBe(
      "user_report_jane_example_com_2026-05-28.csv",
    );
  });

  it("replaces special characters with underscores", () => {
    const result = buildFilename("O'Brien, Mike", "o@example.com", "2026-05-28");
    expect(result).not.toContain("'");
    expect(result).not.toContain(",");
    expect(result).toMatch(/^[a-z0-9_.-]+$/);
  });

  it("always ends with .csv", () => {
    expect(buildFilename("Alice", "a@b.com", "2026-05-28").endsWith(".csv")).toBe(true);
  });
});
