import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";

test("dashboard keeps management separate, restores inventory links, and places TV launcher last", async ({ context, page, baseURL }) => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires development offline auth with matching JWT_SECRET and E2E_REPORT_SECRET.");
  const token = await new SignJWT({
    userId: "dashboard-manager", storeId: "dashboard-store", storeName: "Dashboard Store",
    name: "Dashboard Manager", email: "dashboard@example.test", role: "MANAGER", grantedPermissions: [],
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
  await context.addCookies([{ name: "lottoops_session", value: token, url: baseURL! }]);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What would you like to do?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage Workspace" })).toHaveAttribute("href", "/admin");
  await expect(page.getByRole("heading", { name: "TV Display Board" })).toBeVisible();
  const alertsSection = page.locator("section[aria-label='Operations Alerts']");
  await expect(alertsSection).toBeVisible();
  await expect(alertsSection.getByRole("link", { name: "Alerts" })).toHaveAttribute("href", "/alerts");
  await expect(page.getByRole("link", { name: "Reports" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Active Stock" })).toHaveAttribute("href", "/inventory/active");
  await expect(page.getByRole("link", { name: "Back Stock" })).toHaveAttribute("href", "/inventory/back-stock");
  await expect(page.getByRole("link", { name: "Live Inventory Map" })).toHaveAttribute("href", "/admin/inventory");
  await expect(page.getByRole("link", { name: "Displays" })).toHaveCount(0);

  const launcher = page.locator("div[class*='lg:col-start-4']").filter({ has: page.getByRole("heading", { name: "TV Display Board" }) });
  await expect(launcher).toBeVisible();
  const placement = await page.evaluate(({ gridSelector, launcherSelector }) => {
    const gridElement = document.querySelector(gridSelector);
    const launcherElement = document.querySelector(launcherSelector);
    if (!gridElement || !launcherElement) return null;
    const gridStyle = getComputedStyle(gridElement);
    const launcherStyle = getComputedStyle(launcherElement);
    return { columns: gridStyle.gridTemplateColumns.split(" ").length, columnStart: launcherStyle.gridColumnStart };
  }, {
    gridSelector: "section[aria-label='POS operations'] > div.grid",
    launcherSelector: "div[class*='lg:col-start-4']",
  });
  expect(placement).not.toBeNull();
  if (page.viewportSize()!.width >= 1024) {
    expect(placement?.columns).toBe(4);
    expect(placement?.columnStart).toBe("4");
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
