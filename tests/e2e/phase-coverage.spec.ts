import { test, expect } from "@playwright/test";

const protectedPages = [
  ["Phase 1 POS terminal", "/pos"],
  ["Phase 2 Receive Stock", "/inventory/receive"],
  ["Phase 3 Inventory", "/inventory"],
  ["Phase 4 Reconciliation", "/admin/reconciliation"],
  ["Phase 5 COMMAND inventory", "/admin/command-center"],
  ["Phase 6 Billing", "/billing"],
  ["Phase 7 Admin Reports", "/admin/reports"],
  ["Phase 8 Shift Management", "/shifts"],
  ["Updated Owner dashboard", "/owner"],
  ["Updated Owner stores", "/owner/stores"],
  ["Updated Owner store detail", "/owner/stores/test-store"],
  ["Updated Employee workspace", "/employee"],
] as const;

test.describe("LottoOps Phase 1–8 public integration contracts", () => {
  test("login page is reachable and exposes the supported sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("staff select an open terminal and Shift 1 or 2 before the final sign-in", async ({ page }) => {
    const loginRequests: Array<Record<string, unknown>> = [];
    await page.route("**/api/auth/login", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      loginRequests.push(body);
      if (body.shiftId !== "shift-t2-2") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            code: "SHIFT_SELECTION_REQUIRED",
            error: "Choose an open terminal and shift before signing in.",
            openShifts: [
              { id: "shift-t1-1", shiftNumber: 1, terminalId: "T1" },
              { id: "shift-t2-2", shiftNumber: 2, terminalId: "T2" },
            ],
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, user: { role: "EMPLOYEE" } }),
      });
    });

    await page.goto("/login");
    const emailInput = page.getByLabel("Email address");
    await expect(emailInput).toBeFocused();
    await emailInput.fill("cashier@example.com");
    await page.getByRole("textbox", { name: "Password" }).fill("test-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    const selector = page.getByLabel("Terminal and shift");
    await expect(selector).toBeVisible();
    await expect(selector.locator("option")).toHaveText([
      "Select an open terminal shift",
      "T1 · Shift 1",
      "T2 · Shift 2",
    ]);
    await selector.selectOption("shift-t2-2");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect.poll(() => loginRequests.length).toBe(2);
    expect(loginRequests[1].shiftId).toBe("shift-t2-2");
  });

  for (const [name, route] of protectedPages) {
    test(`${name} is protected when no staff session exists`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByLabel("Email address")).toBeVisible();
    });
  }

  test("unauthenticated APIs reject protected operational requests", async ({ request }) => {
    const checks: Array<[string, "get" | "post"]> = [
      ["/api/packs/check-serial", "post"],
      ["/api/pos/inventory-status", "get"],
      ["/api/pos/reconciliation", "get"],
      ["/api/reports/shifts", "get"],
      ["/api/billing/portal", "post"],
    ];
    for (const [endpoint, method] of checks) {
      const response = method === "post" ? await request.post(endpoint, { data: {} }) : await request.get(endpoint);
      expect(response.status(), endpoint).toBe(401);
    }
  });

  test("scheduled financial summaries require the cron secret", async ({ request }) => {
    const response = await request.get("/api/cron/financial-summary?period=daily");
    expect(response.status()).toBe(401);
  });

  test("billing webhook rejects an unsigned request", async ({ request }) => {
    const response = await request.post("/api/billing/webhook", { data: {} });
    expect([400, 401, 503]).toContain(response.status());
  });
});

test.describe("Authenticated POS workflow integration", () => {
  test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated browser coverage.");

  test("owner can sign in and reach the POS/admin split", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(process.env.E2E_TEST_EMAIL ?? "");
    await page.getByRole("textbox", { name: "Password" }).fill(process.env.E2E_TEST_PASSWORD ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Track Tickets")).toBeVisible();
    await expect(page.getByText("Store Admin")).toBeVisible();
  });

  test("authenticated management pages expose the shared back control", async ({ page }) => {
    await page.goto("/admin/reports");
    await expect(page.getByRole("button", { name: "Go back to the previous page" })).toBeVisible();
    await page.goto("/admin/command-center");
    await expect(page.getByRole("button", { name: "Go back to the previous page" })).toBeVisible();
  });
});
