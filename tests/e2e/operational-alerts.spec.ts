import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";

test("operational alerts show readable pack labels, next steps, and stay cleared after refresh", async ({ context, page, baseURL }) => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires development offline auth with matching JWT_SECRET and E2E_REPORT_SECRET.");
  const token = await new SignJWT({
    userId: "alerts-manager", storeId: "alerts-store", storeName: "Alerts Store",
    name: "Alerts Manager", email: "alerts@example.test", role: "MANAGER", grantedPermissions: [],
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
  await context.addCookies([{ name: "lottoops_session", value: token, url: baseURL! }]);

  let cleared = false;
  let clearCount = 0;
  const alert = {
    id: "NOTIFICATION_notification-1", alertKey: "NOTIFICATION:notification-1", type: "TICKET_EXCEPTION",
    severity: "HIGH", title: "Out-of-sequence ticket scan",
    detail: "Staff scanned ticket 3 for Pack #00017 · Game #0042. Expected ticket 2. No sale was recorded.",
    createdAt: "2026-11-11T18:00:00.000Z", entityId: "cmvr_internal_pack_id",
    packNumber: "00017", gameNumber: "0042",
  };

  await page.route("**/api/**", (route) => route.fulfill({ json: { alerts: [], requests: [], reports: [], notifications: [], items: [], rows: [] } }));
  await page.route("**/api/alerts/operational", (route) => route.fulfill({ json: { alerts: cleared ? [] : [alert] } }));
  await page.route("**/api/alerts/operational/clear", async (route) => {
    clearCount++;
    cleared = true;
    await route.fulfill({ json: { success: true, cleared: true } });
  });

  await page.goto("/alerts");
  await expect(page.getByText("Pack #00017 · Game #0042", { exact: true })).toBeVisible();
  await expect(page.getByText("cmvr_internal_pack_id")).toHaveCount(0);
  const card = page.locator("div.rounded-md.border").filter({ hasText: "Out-of-sequence ticket scan" }).first();
  await card.getByText("What to do next").click();
  await expect(card.getByText(/expected ticket/i).first()).toBeVisible();
  await expect(card.getByRole("link", { name: "Review Shifts" })).toHaveAttribute("href", "/shifts");
  await card.getByRole("button", { name: "Review & Clear Alert" }).click();
  await expect(page.getByText("Out-of-sequence ticket scan")).toHaveCount(0);
  expect(clearCount).toBe(1);

  await page.reload();
  await expect(page.getByText("No operational alerts detected.")).toBeVisible();
});
