import { test, expect, type BrowserContext } from "@playwright/test";
import { SignJWT } from "jose";

async function signInAsEmployee(context: BrowserContext, baseURL: string, shiftAssigned: boolean) {
  const token = await new SignJWT({
    userId: "employee-track-tickets",
    storeId: "employee-store",
    storeName: "Employee Test Store",
    name: "Employee Test User",
    email: "employee@example.test",
    role: "EMPLOYEE",
    grantedPermissions: [],
    terminalId: "T1",
    shiftId: shiftAssigned ? "shift-1" : undefined,
    shiftNumber: shiftAssigned ? 1 : undefined,
    loginSessionId: "employee-login-session",
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
  await context.addCookies([{ name: "lottoops_session", value: token, url: baseURL }]);
}

test("unassigned employees can open the enabled Track Tickets action to choose a shift", async ({ page, context, baseURL }) => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires local offline auth with matching JWT_SECRET and E2E_REPORT_SECRET.");
  await signInAsEmployee(context, baseURL!, false);
  await page.goto("/employee");

  const trackActions = page.getByRole("link", { name: /Track tickets/i });
  await expect(trackActions).toHaveCount(1);
  await expect(trackActions.first()).toBeEnabled();
  await expect(trackActions.first()).toHaveAttribute("href", "/shifts");
  await trackActions.first().click();
  await expect(page).toHaveURL(/\/shifts$/);
  await expect(page.getByRole("heading", { name: "Unable to verify shift status" })).toBeVisible();
  await page.goto("/sales");
  await expect(page).toHaveURL(/\/shifts$/);
  await expect(page.getByRole("heading", { name: "Unable to verify shift status" })).toBeVisible();
});

test("shift-bound employees can access the shared Track Tickets page", async ({ page, context, baseURL }) => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires local offline auth with matching JWT_SECRET and E2E_REPORT_SECRET.");
  await signInAsEmployee(context, baseURL!, true);
  await page.goto("/sales");
  await expect(page).toHaveURL(/\/sales$/);
  await expect(page.getByText("Database not connected")).toBeVisible();
});
