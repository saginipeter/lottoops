import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";

test.describe("Receiving and backstock regressions", () => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires offline development auth with matching JWT_SECRET and E2E_REPORT_SECRET.");

  test.beforeEach(async ({ context, baseURL }) => {
    const token = await new SignJWT({
      userId: "inventory-operator", storeId: "inventory-store", storeName: "Inventory Store",
      name: "Inventory Operator", email: "operator@example.test", role: "MANAGER", grantedPermissions: [],
    }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
    await context.addCookies([{ name: "lottoops_session", value: token, url: baseURL! }]);
  });

  test("scrolling over focused shipment amounts does not change values", async ({ page }) => {
    await page.goto("/inventory/receive/step/1");
    const fields = page.getByRole("spinbutton");
    await expect(fields).toHaveCount(2);
    for (const [index, value] of ["10", "95.50"].entries()) {
      const field = fields.nth(index);
      await field.fill(value);
      await field.focus();
      await field.hover();
      await page.mouse.wheel(0, -300);
      await expect(field).toHaveValue(value);
      await field.fill(index === 0 ? "11" : "96.50");
      await expect(field).toHaveValue(index === 0 ? "11" : "96.50");
    }
  });

  test("scrolling over the pack quantity does not change its value", async ({ page }) => {
    await page.goto("/inventory/receive/step/2");
    await page.getByLabel("Override default ticket quantity").check();
    const quantity = page.getByRole("spinbutton");
    await quantity.fill("60");
    await quantity.focus();
    await quantity.hover();
    await page.mouse.wheel(0, -300);
    await expect(quantity).toHaveValue("60");
  });

  test("backstock failures offer retry and load current display availability", async ({ page }) => {
    let fail = true;
    await page.route("**/api/packs/back-stock", (route) => route.fulfill({
      status: fail ? 503 : 200,
      json: fail ? { error: "Database not connected" } : [],
    }));
    await page.route("**/api/display-slots", (route) => route.fulfill({
      json: [{ id: "slot-1", slotNumber: "01", packId: null }],
    }));
    await page.goto("/inventory/back-stock");
    await expect(page.getByRole("alert").filter({ hasText: "Database not connected" })).toBeVisible();
    fail = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByText("No packs found.", { exact: true })).toBeVisible();
    await expect(page.getByText("Available Slots: 1", { exact: true })).toBeVisible();
  });

  test("a stalled backstock request times out and can be retried", async ({ page }) => {
    await page.clock.install();
    let stalled = true;
    await page.route("**/api/packs/back-stock", (route) => {
      if (!stalled) return route.fulfill({ json: [] });
    });
    await page.route("**/api/display-slots", (route) => route.fulfill({ json: [] }));
    const started = page.waitForRequest("**/api/packs/back-stock");
    await page.goto("/inventory/back-stock");
    await started;
    await expect(page.getByRole("status").filter({ hasText: "Loading back stock" })).toBeVisible();
    await page.clock.fastForward(16_000);
    await expect(page.getByRole("alert").filter({ hasText: "timed out" })).toBeVisible();
    stalled = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByText("No packs found.", { exact: true })).toBeVisible();
  });
});
