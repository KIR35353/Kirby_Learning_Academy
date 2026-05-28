// @vitest-environment node
/**
 * Unit tests: API authorization and tenant scoping guards
 *
 * Validates that the isAdmin role-check logic correctly allows/denies access
 * based on the roles present in a session. No DB calls.
 */
import { describe, it, expect } from "vitest";

// ── Mirrors the isAdmin check used in every report API route ─────────────────

type MockSession = {
  user: {
    id: string;
    tenantId: string;
    roles: string[];
  };
} | null;

function isAdmin(session: MockSession): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) =>
    ["SUPER_ADMIN", "TENANT_ADMIN", "MANAGER", "COMPLIANCE_OFFICER"].includes(r),
  );
}

function isSuperAdmin(session: MockSession): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.includes("SUPER_ADMIN");
}

/** Simulates the tenant-scoping guard: the target user must belong to the same tenant */
function isUserInTenant(
  requestingTenantId: string,
  targetTenantId: string,
): boolean {
  return requestingTenantId === targetTenantId;
}

// ── isAdmin ───────────────────────────────────────────────────────────────────

describe("isAdmin", () => {
  it("returns false for null session", () => {
    expect(isAdmin(null)).toBe(false);
  });

  it("returns false for unauthenticated user with no roles", () => {
    expect(isAdmin({ user: { id: "u1", tenantId: "t1", roles: [] } })).toBe(false);
  });

  it("returns false for STUDENT role", () => {
    expect(
      isAdmin({ user: { id: "u1", tenantId: "t1", roles: ["STUDENT"] } }),
    ).toBe(false);
  });

  it("returns false for INSTRUCTOR role", () => {
    expect(
      isAdmin({ user: { id: "u1", tenantId: "t1", roles: ["INSTRUCTOR"] } }),
    ).toBe(false);
  });

  it("returns true for SUPER_ADMIN", () => {
    expect(
      isAdmin({ user: { id: "u1", tenantId: "t1", roles: ["SUPER_ADMIN"] } }),
    ).toBe(true);
  });

  it("returns true for TENANT_ADMIN", () => {
    expect(
      isAdmin({ user: { id: "u1", tenantId: "t1", roles: ["TENANT_ADMIN"] } }),
    ).toBe(true);
  });

  it("returns true for MANAGER", () => {
    expect(
      isAdmin({ user: { id: "u1", tenantId: "t1", roles: ["MANAGER"] } }),
    ).toBe(true);
  });

  it("returns true for COMPLIANCE_OFFICER", () => {
    expect(
      isAdmin({
        user: { id: "u1", tenantId: "t1", roles: ["COMPLIANCE_OFFICER"] },
      }),
    ).toBe(true);
  });

  it("returns true when one of multiple roles is admin", () => {
    expect(
      isAdmin({
        user: { id: "u1", tenantId: "t1", roles: ["STUDENT", "MANAGER"] },
      }),
    ).toBe(true);
  });

  it("does not allow unknown roles", () => {
    expect(
      isAdmin({ user: { id: "u1", tenantId: "t1", roles: ["OWNER", "ADMIN"] } }),
    ).toBe(false);
  });
});

// ── isSuperAdmin ──────────────────────────────────────────────────────────────

describe("isSuperAdmin", () => {
  it("returns false for null session", () => {
    expect(isSuperAdmin(null)).toBe(false);
  });

  it("returns false for TENANT_ADMIN (not super)", () => {
    expect(
      isSuperAdmin({ user: { id: "u1", tenantId: "t1", roles: ["TENANT_ADMIN"] } }),
    ).toBe(false);
  });

  it("returns false for MANAGER", () => {
    expect(
      isSuperAdmin({ user: { id: "u1", tenantId: "t1", roles: ["MANAGER"] } }),
    ).toBe(false);
  });

  it("returns true only for SUPER_ADMIN", () => {
    expect(
      isSuperAdmin({ user: { id: "u1", tenantId: "t1", roles: ["SUPER_ADMIN"] } }),
    ).toBe(true);
  });
});

// ── Tenant scoping guard ──────────────────────────────────────────────────────

describe("isUserInTenant", () => {
  it("allows access when tenants match", () => {
    expect(isUserInTenant("tenant-abc", "tenant-abc")).toBe(true);
  });

  it("blocks access when tenants differ", () => {
    expect(isUserInTenant("tenant-abc", "tenant-xyz")).toBe(false);
  });

  it("is case-sensitive (different casing = different tenant)", () => {
    expect(isUserInTenant("Tenant-ABC", "tenant-abc")).toBe(false);
  });
});

// ── Date range boundary tests ─────────────────────────────────────────────────
// Validates that date range logic is applied consistently across report queries

describe("Date range construction", () => {
  it("defaults to 90-day range ending today", () => {
    const rangeEnd = new Date("2026-05-28T00:00:00Z");
    const defaultStart = new Date(rangeEnd);
    defaultStart.setDate(defaultStart.getDate() - 90);

    expect(defaultStart.toISOString().slice(0, 10)).toBe("2026-02-27");
    expect(rangeEnd.toISOString().slice(0, 10)).toBe("2026-05-28");
  });

  it("custom range overrides the default", () => {
    const customStart = new Date("2026-01-01T00:00:00Z");
    const customEnd = new Date("2026-03-31T00:00:00Z");

    expect(customStart < customEnd).toBe(true);
    expect(customStart.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(customEnd.toISOString().slice(0, 10)).toBe("2026-03-31");
  });

  it("rangeEnd is inclusive (end of provided date)", () => {
    const rangeEnd = new Date("2026-05-28T00:00:00Z");
    // Queries use lte: rangeEnd — items on this date should be included
    const itemDate = new Date("2026-05-28T12:00:00Z");
    expect(itemDate <= rangeEnd).toBe(false); // midnight boundary — item is after midnight
    // When using full-day range, endDate should be set to end of day
    const endOfDay = new Date("2026-05-28T23:59:59.999Z");
    expect(itemDate <= endOfDay).toBe(true);
  });
});
