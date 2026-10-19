import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";

test("latest POS sale remains visible until a new successful scan replaces it", async ({ context, page, baseURL }) => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires development offline auth with matching JWT_SECRET and E2E_REPORT_SECRET.");
  const token = await new SignJWT({
    userId: "pos-operator", storeId: "pos-store", storeName: "POS Store",
    name: "POS Operator", email: "pos@example.test", role: "MANAGER", grantedPermissions: [],
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
  await context.addCookies([{ name: "lottoops_session", value: token, url: baseURL! }]);
  await page.route("**/api/pos/inventory-status", (route) => route.fulfill({ json: { alerts: [] } }));
  await page.route("**/api/pos/reconciliation?*", (route) => route.fulfill({ json: { items: [] } }));
  let sales = 0;
  await page.route("**/api/packs/check-serial", async (route) => {
    sales++;
    if (sales === 2) {
      await route.fulfill({ status: 409, json: { error: "Unexpected ticket" } });
      return;
    }
    await route.fulfill({ json: {
      id: "pack", saleId: `sale-${sales}`, shiftId: "shift",
      ticketBarcode: route.request().postDataJSON().serialNumber,
      gameName: sales === 1 ? "First game" : "Second game",
      salesAmount: 1, nextTicketNumber: sales + 1, slot: { slotNumber: "1" }, packStatus: "ACTIVE",
    } });
  });
  await page.goto("/pos");
  const input = page.getByPlaceholder("Scan or enter 14 digits");
  const latest = page.locator("aside").filter({ has: page.getByRole("heading", { name: "Latest scan" }) });
  await expect(input).toBeVisible();
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await input.fill("12341234567001");
  await input.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Sale complete" });
  await expect(dialog).toBeVisible();
  await page.clock.runFor(2499);
  await expect(dialog).toBeVisible();
  await page.clock.runFor(1);
  await expect(dialog).toHaveCount(0);
  await page.clock.runFor(80);
  await expect(input).toBeFocused();
  await expect(latest.getByText("First game", { exact: true })).toBeVisible();
  await latest.getByRole("button", { name: "Scan next ticket" }).click();
  await expect(latest.getByText("First game", { exact: true })).toBeVisible();
  await input.fill("12341234567002");
  await input.press("Enter");
  await expect(page.getByText("Unexpected ticket", { exact: true })).toBeVisible();
  const error = page.getByRole("alert").filter({ hasText: "Scan blocked" });
  const bounds = await error.boundingBox();
  expect(bounds?.y).toBe(16);
  await page.clock.runFor(2999);
  await expect(error).toBeVisible();
  await page.clock.runFor(1);
  await expect(error).toHaveCount(0);
  await expect(latest.getByText("First game", { exact: true })).toBeVisible();
  await input.fill("12341234567003");
  await input.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Scan next ticket" }).click();
  await expect(latest.getByText("Second game", { exact: true })).toBeVisible();
  await expect(latest.getByText("First game", { exact: true })).toHaveCount(0);
  await input.fill("123");
  await input.press("Enter");
  await expect(error).toContainText("complete 14-digit ticket barcode");
  await page.clock.runFor(2000);
  await input.press("Enter");
  await page.clock.runFor(2000);
  await expect(error).toBeVisible();
  await page.clock.runFor(1000);
  await expect(error).toHaveCount(0);
  expect(sales).toBe(3);
});
