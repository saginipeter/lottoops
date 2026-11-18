import { test, expect, type BrowserContext } from "@playwright/test";
import { SignJWT } from "jose";

async function signIn(context: BrowserContext, baseURL: string, role: "OWNER" | "MANAGER" | "EMPLOYEE") {
  const token = await new SignJWT({
    userId: `support-${role.toLowerCase()}`,
    storeId: "support-widget-store",
    storeName: "Support Widget Store",
    name: `${role} Test User`,
    email: `${role.toLowerCase()}@example.test`,
    role,
    grantedPermissions: [],
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
  await context.addCookies([{ name: "lottoops_session", value: token, url: baseURL }]);
}

test.describe("floating owner and manager support widget", () => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires local offline auth with matching JWT_SECRET and E2E_REPORT_SECRET.");

  test("manager sends a support message and opens the TV display", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "MANAGER");
    const kioskToken = await new SignJWT({ type: "TV_KIOSK", storeId: "support-widget-store", storeName: "Support Widget Store" })
      .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));

    let postedMessage: Record<string, unknown> | null = null;
    await page.route("**/api/support-tickets", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { tickets: [] } });
        return;
      }
      postedMessage = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, json: { ticket: {
        id: "support-message-1",
        subject: postedMessage.subject,
        description: postedMessage.description,
        priority: "NORMAL",
        status: "OPEN",
        createdAt: new Date().toISOString(),
      } } });
    });
    await page.route("**/api/tv-display/kiosk-token", async (route) => {
      expect(route.request().method()).toBe("POST");
      await route.fulfill({ json: { kioskUrl: `${baseURL}/tv-display?token=${encodeURIComponent(kioskToken)}&kiosk=1&screen=1` } });
    });
    await context.route("**/tv-display?*", (route) => route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>TV Display Test</title><main>TV display launch verified</main>",
    }));

    await page.goto("/");
    await page.getByRole("button", { name: "Open support chat" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Topic").fill("Scanner not detecting a pack");
    await page.getByLabel("Your message").fill("The barcode scans, but the game details do not appear.");
    await page.getByRole("button", { name: "Send support message" }).click();
    await expect(page.getByRole("status")).toContainText("Your message was sent");
    await expect(page.getByText("Scanner not detecting a pack", { exact: true })).toBeVisible();
    expect(postedMessage).toMatchObject({
      subject: "Scanner not detecting a pack",
      description: "The barcode scans, but the game details do not appear.",
      priority: "NORMAL",
    });

    await page.getByRole("button", { name: "Close" }).click();
    await page.goto("/support");
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Open TV Display Board" }).click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/\/tv-display\?token=.*kiosk=1&screen=1/);
    await expect(popup).toHaveTitle(/LottoOps|TV|Display/i);
    await popup.close();
  });

  test("owner can access the support widget, while employee cannot", async ({ browser, baseURL }) => {
    const ownerContext = await browser.newContext();
    await signIn(ownerContext, baseURL!, "OWNER");
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto("/");
    await expect(ownerPage.getByRole("button", { name: "Open support chat" })).toBeVisible();
    await ownerPage.goto("/support");
    await expect(ownerPage.getByRole("button", { name: "Open TV Display Board" })).toBeEnabled();
    await ownerContext.close();

    const employeeContext = await browser.newContext();
    await signIn(employeeContext, baseURL!, "EMPLOYEE");
    const employeePage = await employeeContext.newPage();
    await employeePage.goto("/");
    await expect(employeePage.getByRole("button", { name: "Open support chat" })).toHaveCount(0);
    await expect(employeePage.getByRole("button", { name: "Open TV Display Board" })).toHaveCount(0);
    await employeeContext.close();
  });
});
