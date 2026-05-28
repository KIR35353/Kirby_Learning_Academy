// @vitest-environment node
/**
 * Unit tests: User Report metric helpers
 *
 * Tests the pure calculation functions used by the user summary and export
 * endpoints. No DB or auth needed — pure function tests.
 */
import { describe, it, expect } from "vitest";

// ── Helpers copied/extracted from the API routes ─────────────────────────────

type EnrollmentStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PASSED"
  | "FAILED"
  | "EXPIRED";

function calcCompletionRate(
  statusCounts: Partial<Record<EnrollmentStatus, number>>,
): number {
  const total = Object.values(statusCounts).reduce(
    (acc, v) => acc + (v ?? 0),
    0,
  );
  const completed =
    (statusCounts.PASSED ?? 0) + (statusCounts.COMPLETED ?? 0);
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

function calcPassRate(passed: number, failed: number): number {
  const total = passed + failed;
  return total > 0 ? Math.round((passed / total) * 100) : 0;
}

function calcPercentile(rank: number, totalUsers: number): number {
  return totalUsers > 1
    ? Math.round((1 - (rank - 1) / (totalUsers - 1)) * 100)
    : 100;
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toDateOrDefault(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

// ── calcCompletionRate ────────────────────────────────────────────────────────

describe("calcCompletionRate", () => {
  it("returns 0 when no enrollments", () => {
    expect(calcCompletionRate({})).toBe(0);
  });

  it("returns 100 when all completed", () => {
    expect(calcCompletionRate({ COMPLETED: 5 })).toBe(100);
  });

  it("returns 100 when all passed", () => {
    expect(calcCompletionRate({ PASSED: 3 })).toBe(100);
  });

  it("treats PASSED and COMPLETED both as completed", () => {
    expect(calcCompletionRate({ PASSED: 2, COMPLETED: 3, IN_PROGRESS: 5 })).toBe(50);
  });

  it("rounds to nearest integer", () => {
    // 1 completed out of 3 = 33.33% → rounds to 33
    expect(calcCompletionRate({ COMPLETED: 1, IN_PROGRESS: 2 })).toBe(33);
  });

  it("handles zero totals correctly", () => {
    expect(calcCompletionRate({ NOT_STARTED: 0 })).toBe(0);
  });

  it("does not count FAILED or NOT_STARTED as completed", () => {
    expect(
      calcCompletionRate({
        FAILED: 3,
        NOT_STARTED: 2,
        IN_PROGRESS: 1,
        COMPLETED: 4,
      }),
    ).toBe(40); // 4 of 10
  });
});

// ── calcPassRate ──────────────────────────────────────────────────────────────

describe("calcPassRate", () => {
  it("returns 0 when no attempts", () => {
    expect(calcPassRate(0, 0)).toBe(0);
  });

  it("returns 100 when all passed", () => {
    expect(calcPassRate(10, 0)).toBe(100);
  });

  it("returns 0 when all failed", () => {
    expect(calcPassRate(0, 10)).toBe(0);
  });

  it("calculates correctly", () => {
    expect(calcPassRate(3, 1)).toBe(75);
  });

  it("rounds correctly", () => {
    // 1/3 = 33.33%
    expect(calcPassRate(1, 2)).toBe(33);
  });
});

// ── calcPercentile ────────────────────────────────────────────────────────────

describe("calcPercentile", () => {
  it("returns 100 for rank 1 of 1", () => {
    expect(calcPercentile(1, 1)).toBe(100);
  });

  it("returns 100 for rank 1 of many", () => {
    expect(calcPercentile(1, 100)).toBe(100);
  });

  it("returns 0 for last rank", () => {
    expect(calcPercentile(100, 100)).toBe(0);
  });

  it("returns 50th percentile for median rank", () => {
    // rank 51 of 101 → (1 - 50/100) = 0.5 → 50
    expect(calcPercentile(51, 101)).toBe(50);
  });

  it("returns 99th percentile for 2nd of 100", () => {
    // (1 - 1/99) = 98.98% → rounds to 99
    expect(calcPercentile(2, 100)).toBe(99);
  });
});

// ── csvCell ───────────────────────────────────────────────────────────────────

describe("csvCell", () => {
  it("returns empty string for null", () => {
    expect(csvCell(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(csvCell(undefined)).toBe("");
  });

  it("passes through plain strings unchanged", () => {
    expect(csvCell("hello")).toBe("hello");
  });

  it("converts numbers to strings", () => {
    expect(csvCell(42)).toBe("42");
  });

  it("wraps values containing commas in quotes", () => {
    expect(csvCell("Smith, John")).toBe('"Smith, John"');
  });

  it("wraps values containing double-quotes and escapes them", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps values containing newlines", () => {
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("does not wrap plain values in quotes", () => {
    const result = csvCell("NoSpecialChars");
    expect(result.startsWith('"')).toBe(false);
  });
});

// ── toDateOrDefault ───────────────────────────────────────────────────────────

describe("toDateOrDefault", () => {
  const fallback = new Date("2026-01-01T00:00:00Z");

  it("returns fallback when value is null", () => {
    expect(toDateOrDefault(null, fallback)).toEqual(fallback);
  });

  it("returns fallback when value is empty string", () => {
    expect(toDateOrDefault("", fallback)).toEqual(fallback);
  });

  it("returns fallback when value is an invalid date", () => {
    expect(toDateOrDefault("not-a-date", fallback)).toEqual(fallback);
  });

  it("parses a valid ISO date string", () => {
    const result = toDateOrDefault("2026-05-15T00:00:00Z", fallback);
    expect(result.toISOString()).toBe("2026-05-15T00:00:00.000Z");
  });

  it("parses a date-only string", () => {
    const result = toDateOrDefault("2026-05-15", fallback);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4); // May = 4
  });
});
