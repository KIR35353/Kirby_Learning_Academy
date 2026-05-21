import { describe, it, expect } from "vitest";

// ── Utility: getInitials ─────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

describe("getInitials", () => {
  it("extracts initials from full name", () => {
    expect(getInitials("John Smith")).toBe("JS");
  });

  it("handles single word", () => {
    expect(getInitials("Alice")).toBe("A");
  });

  it("handles extra whitespace", () => {
    expect(getInitials("  Bob   Jones  ")).toBe("BJ");
  });

  it("returns empty string for empty input", () => {
    expect(getInitials("")).toBe("");
  });
});

// ── Rate limit key helper ─────────────────────────────────────────────────────
function buildRateLimitKey(ip: string, email?: string): string {
  return email ? `${ip}_${email.toLowerCase()}` : ip;
}

describe("buildRateLimitKey", () => {
  it("returns ip when no email given", () => {
    expect(buildRateLimitKey("1.2.3.4")).toBe("1.2.3.4");
  });

  it("combines ip and lowercase email", () => {
    expect(buildRateLimitKey("1.2.3.4", "User@Example.com")).toBe("1.2.3.4_user@example.com");
  });
});

// ── Notification type labels ──────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  COURSE_ASSIGNED: "Course Assigned",
  COURSE_DUE_SOON: "Course Due Soon",
  BROADCAST: "Broadcast",
};

describe("notification type labels", () => {
  it("has label for COURSE_ASSIGNED", () => {
    expect(TYPE_LABELS["COURSE_ASSIGNED"]).toBe("Course Assigned");
  });

  it("returns undefined for unknown type", () => {
    expect(TYPE_LABELS["UNKNOWN"]).toBeUndefined();
  });
});
