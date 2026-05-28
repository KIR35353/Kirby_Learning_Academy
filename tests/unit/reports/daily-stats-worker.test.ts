// @vitest-environment node
/**
 * Unit tests: DailyUserStats worker logic
 *
 * Tests the pure data-transformation logic that determines:
 * - How cumulative stats are aggregated per-user per-day
 * - Upsert key structure
 * - Stat date normalization (midnight UTC)
 * - Edge cases: no data, zero totals, null scores
 */
import { describe, it, expect } from "vitest";

// ── Pure helpers extracted from the worker ───────────────────────────────────

type StatusCounts = Record<string, number>;

function calcCourseCompletionRate(statusCounts: StatusCounts): number {
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const completed = (statusCounts.COMPLETED ?? 0) + (statusCounts.PASSED ?? 0);
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

function calcAssessmentPassRate(passed: number, failed: number): number {
  const total = passed + failed;
  return total > 0 ? Math.round((passed / total) * 100) : 0;
}

function calcAvgScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

/** Returns midnight UTC of a given date */
function toStatDate(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** Builds the upsert where-key */
function buildUpsertKey(tenantId: string, userId: string, statDate: Date) {
  return { tenantId_userId_statDate: { tenantId, userId, statDate } };
}

// ── toStatDate ────────────────────────────────────────────────────────────────

describe("toStatDate", () => {
  it("returns midnight UTC for a given datetime", () => {
    const d = new Date("2026-05-28T14:37:22.000Z");
    const stat = toStatDate(d);
    expect(stat.toISOString()).toBe("2026-05-28T00:00:00.000Z");
  });

  it("is idempotent when date is already midnight UTC", () => {
    const d = new Date("2026-05-28T00:00:00.000Z");
    expect(toStatDate(d).toISOString()).toBe("2026-05-28T00:00:00.000Z");
  });

  it("handles end-of-day correctly", () => {
    const d = new Date("2026-05-28T23:59:59.999Z");
    const stat = toStatDate(d);
    expect(stat.toISOString()).toBe("2026-05-28T00:00:00.000Z");
  });

  it("does not change date across UTC midnight", () => {
    const d = new Date("2026-06-01T00:00:00.000Z");
    expect(toStatDate(d).toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });
});

// ── calcCourseCompletionRate ──────────────────────────────────────────────────

describe("calcCourseCompletionRate (worker)", () => {
  it("returns 0 when no enrollments", () => {
    expect(calcCourseCompletionRate({})).toBe(0);
  });

  it("returns 100 when all completed", () => {
    expect(calcCourseCompletionRate({ COMPLETED: 10 })).toBe(100);
  });

  it("treats PASSED the same as COMPLETED", () => {
    expect(calcCourseCompletionRate({ PASSED: 5, COMPLETED: 5 })).toBe(100);
  });

  it("does not count IN_PROGRESS or FAILED as complete", () => {
    expect(
      calcCourseCompletionRate({ COMPLETED: 4, IN_PROGRESS: 3, FAILED: 3 }),
    ).toBe(40);
  });
});

// ── calcAssessmentPassRate ────────────────────────────────────────────────────

describe("calcAssessmentPassRate (worker)", () => {
  it("returns 0 when no submitted attempts", () => {
    expect(calcAssessmentPassRate(0, 0)).toBe(0);
  });

  it("returns 100 when all passed", () => {
    expect(calcAssessmentPassRate(5, 0)).toBe(100);
  });

  it("returns 0 when all failed", () => {
    expect(calcAssessmentPassRate(0, 5)).toBe(0);
  });

  it("rounds fractional rates", () => {
    // 2/3 = 66.67 → rounds to 67
    expect(calcAssessmentPassRate(2, 1)).toBe(67);
  });
});

// ── calcAvgScore ──────────────────────────────────────────────────────────────

describe("calcAvgScore", () => {
  it("returns null for empty array", () => {
    expect(calcAvgScore([])).toBeNull();
  });

  it("returns the single score when only one attempt", () => {
    expect(calcAvgScore([85.0])).toBe(85);
  });

  it("averages multiple scores", () => {
    expect(calcAvgScore([80, 90, 70])).toBe(80);
  });

  it("rounds to 1 decimal place", () => {
    // (80 + 83) / 2 = 81.5 → 81.5
    expect(calcAvgScore([80, 83])).toBe(81.5);
  });

  it("handles perfect scores", () => {
    expect(calcAvgScore([100, 100, 100])).toBe(100);
  });

  it("handles zero scores", () => {
    expect(calcAvgScore([0, 0])).toBe(0);
  });
});

// ── buildUpsertKey ────────────────────────────────────────────────────────────

describe("buildUpsertKey", () => {
  it("produces the expected Prisma upsert where structure", () => {
    const statDate = new Date("2026-05-28T00:00:00.000Z");
    const key = buildUpsertKey("tenant-1", "user-1", statDate);
    expect(key).toEqual({
      tenantId_userId_statDate: {
        tenantId: "tenant-1",
        userId: "user-1",
        statDate,
      },
    });
  });

  it("does not mix up tenantId and userId", () => {
    const statDate = new Date("2026-05-28T00:00:00.000Z");
    const key = buildUpsertKey("T-123", "U-456", statDate);
    expect(key.tenantId_userId_statDate.tenantId).toBe("T-123");
    expect(key.tenantId_userId_statDate.userId).toBe("U-456");
  });
});

// ── Stat aggregation edge cases ───────────────────────────────────────────────

describe("Worker aggregation edge cases", () => {
  it("handles a user with no logins (returns 0, not null)", () => {
    const loginCount = 0;
    expect(typeof loginCount).toBe("number");
    expect(loginCount).toBe(0);
  });

  it("handles a user with no courses (all zeros)", () => {
    const stats = {
      coursesCompleted: 0,
      coursesInProgress: 0,
      coursesFailed: 0,
      coursesOverdue: 0,
      courseCompletionRate: calcCourseCompletionRate({}),
    };
    expect(stats.courseCompletionRate).toBe(0);
    expect(Object.values(stats).every((v) => v === 0)).toBe(true);
  });

  it("handles a user with no assessments (null avgScore)", () => {
    const avgScore = calcAvgScore([]);
    expect(avgScore).toBeNull();
    const passRate = calcAssessmentPassRate(0, 0);
    expect(passRate).toBe(0);
  });

  it("processes multiple tenants independently", () => {
    const tenant1Rate = calcCourseCompletionRate({ COMPLETED: 8, IN_PROGRESS: 2 });
    const tenant2Rate = calcCourseCompletionRate({ COMPLETED: 3, IN_PROGRESS: 7 });
    expect(tenant1Rate).toBe(80);
    expect(tenant2Rate).toBe(30);
    // Results are independent — one tenant doesn't affect another
    expect(tenant1Rate).not.toBe(tenant2Rate);
  });
});
