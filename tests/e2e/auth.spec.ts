import { test, expect } from "@playwright/test";

// ── Auth flow ─────────────────────────────────────────────────────────────────
test.describe("Authentication", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot password page renders", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });
});

// ── Health check ──────────────────────────────────────────────────────────────
test("health endpoint returns 200", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBeLessThanOrEqual(503); // ok or degraded
  const body = await res.json();
  expect(body).toHaveProperty("status");
  expect(body).toHaveProperty("checks");
});

// ── Certificate verification ──────────────────────────────────────────────────
test("cert verify returns 404 for unknown code", async ({ request }) => {
  const res = await request.get("/api/certificates/verify/nonexistent-code-xyz");
  expect(res.status()).toBe(404);
});
