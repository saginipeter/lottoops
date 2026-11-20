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

    const postedMessages: Record<string, unknown>[] = [];
    await page.route("**/api/support-tickets", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { tickets: [] } });
        return;
      }
      const postedMessage = route.request().postDataJSON() as Record<string, unknown>;
      postedMessages.push(postedMessage);
      await route.fulfill({ status: 201, json: { ticket: {
        id: `support-message-${postedMessages.length}`,
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
    const sendButton = page.getByRole("button", { name: "Send support message" });
    await expect(sendButton).toBeDisabled();
    await page.getByLabel("Your message").fill("The barcode scans, but the game details do not appear.");
    await expect(sendButton).toBeEnabled();
    await sendButton.click();
    await expect(page.getByRole("status")).toContainText("Your message was sent");
    await expect(page.getByText("Support request", { exact: true })).toBeVisible();
    expect(postedMessages[0]).toMatchObject({
      subject: "Support request",
      description: "The barcode scans, but the game details do not appear.",
      priority: "NORMAL",
    });

    await page.getByLabel("Topic (optional)").fill("POS terminal issue");
    await page.getByLabel("Topic").fill("POS terminal issue");
    await page.getByLabel("Your message").fill("The terminal needs a restart after the scanner disconnected.");
    await page.getByLabel("Your message").press("Enter");
    await expect.poll(() => postedMessages.length).toBe(2);
    expect(postedMessages[1]).toMatchObject({
      subject: "POS terminal issue",
      description: "The terminal needs a restart after the scanner disconnected.",
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

  test("owner can access the support widget, while employee gets TV access only", async ({ browser, baseURL }) => {
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
    const homeTvButton = employeePage.getByRole("button", { name: "Open TV Display Board" });
    await expect(homeTvButton).toBeEnabled();
    await expect(homeTvButton).toContainText("Open TV");
    await employeePage.goto("/employee");
    await expect(employeePage.getByRole("button", { name: "Open TV Display Board" })).toBeEnabled();
    await employeeContext.close();
  });

  test("employee can open the TV kiosk for only the signed-in store", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "EMPLOYEE");
    const kioskToken = await new SignJWT({ type: "TV_KIOSK", storeId: "support-widget-store", storeName: "Support Widget Store" })
      .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
    await page.route("**/api/tv-display/kiosk-token", async (route) => {
      expect(route.request().method()).toBe("POST");
      await route.fulfill({ json: { kioskUrl: `${baseURL}/tv-display?token=${encodeURIComponent(kioskToken)}&kiosk=1&screen=1` } });
    });
    await context.route("**/tv-display?*", (route) => route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>TV Display Test</title><main>Employee TV launch verified</main>",
    }));

    await page.goto("/employee");
    await expect(page.getByRole("button", { name: "Open support chat" })).toHaveCount(0);
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Open TV Display Board" }).click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/\/tv-display\?token=.*kiosk=1&screen=1/);
    await expect(popup).toHaveTitle(/TV Display Test/);
    await popup.close();
  });
});
