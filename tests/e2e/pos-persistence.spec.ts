import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";

test("latest POS sale remains visible until a new successful scan replaces it", async ({ context, page, baseURL }) => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires development offline auth with matching JWT_SECRET and E2E_REPORT_SECRET.");
  const token = await new SignJWT({
    userId: "pos-operator", storeId: "pos-store", storeName: "POS Store",
    name: "POS Operator", email: "pos@example.test", role: "MANAGER", grantedPermissions: [],
    shiftId: "shift", shiftNumber: 1, terminalId: "T1", loginSessionId: "login-pos-operator",
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
  await context.addCookies([{ name: "lottoops_session", value: token, url: baseURL! }]);
  await page.route("**/api/pos/inventory-status", (route) => route.fulfill({ json: { alerts: [] } }));
  await page.route("**/api/pos/reconciliation?*", (route) => route.fulfill({ json: { items: [] } }));
  let sales = 0;
  await page.route("**/api/packs/check-serial", async (route) => {
    sales++;
    if (sales === 2) {
      await route.fulfill({ status: 409, json: { code: "TICKET_SEQUENCE_MISMATCH", noSale: true, packId: "pack", expectedTicket: 50, scannedTicketNumber: 1, error: "Wrong ticket scanned in this shift. No ticket was tracked. The system expected ticket 50; ticket 1 was scanned." } });
      return;
    }
    await route.fulfill({ json: {
      id: "pack", saleId: `sale-${sales}`, shiftId: "shift",
      ticketBarcode: route.request().postDataJSON().serialNumber,
      gameName: sales === 1 ? "First game" : "Second game",
      salesAmount: 1, nextTicketNumber: sales + 1, slot: { slotNumber: "1" }, packStatus: "ACTIVE",
    } });
  });
  await page.goto("/pos?shiftId=shift&terminal=T1");
  const input = page.getByPlaceholder("Scan or enter 14 digits");
  const latest = page.locator("aside").filter({ has: page.getByRole("heading", { name: "Latest scan" }) });
  await expect(input).toBeVisible();
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await input.fill("12341234567001");
  await input.press("Enter");
  const success = page.getByRole("status").filter({ hasText: "First game" });
  await expect(success).toBeVisible();
  await expect(success).toContainText("Ticket Tracked Successfully");
  await expect(success).toContainText("First game");
  await expect(success).toHaveCSS("pointer-events", "none");
  const successBounds = await success.boundingBox();
  expect(successBounds?.height).toBeGreaterThanOrEqual(120);
  expect(successBounds?.width).toBeGreaterThanOrEqual(320);
  await expect(input).toBeEnabled();
  await page.clock.runFor(3499);
  await expect(success).toBeVisible();
  await page.clock.runFor(1);
  await expect(success).toHaveCount(0);
  await page.clock.runFor(80);
  await expect(input).toBeFocused();
  await expect(latest.getByText("First game", { exact: true })).toBeVisible();
  await latest.getByRole("button", { name: "Scan next ticket" }).click();
  await expect(latest.getByText("First game", { exact: true })).toBeVisible();
  await input.fill("12341234567002");
  await input.press("Enter");
  const error = page.getByRole("alert").filter({ hasText: "Ticket scan error" });
  await expect(error).toContainText("Ticket scan error · no ticket tracked");
  await expect(error).toContainText("Wrong ticket scanned in this shift. No ticket was tracked.");
  await expect(error).toContainText("Expected ticket 50; ticket 1 was scanned");
  await expect(error).not.toContainText("manager");
  const bounds = await error.boundingBox();
  expect(bounds?.y).toBe(16);
  await expect(input).toBeEnabled();
  await expect(latest.getByText("First game", { exact: true })).toBeVisible();
  await page.clock.runFor(4000);
  await expect(error).toHaveCount(0);
  await input.fill("12341234567003");
  await input.press("Enter");
  await expect.poll(() => sales, { timeout: 2000 }).toBe(3);
  await expect(page.getByRole("status").filter({ hasText: "Second game" })).toContainText("Ticket Tracked Successfully");
  await expect(error).toHaveCount(0);
  await expect(input).toBeEnabled();
  await expect(latest.getByText("Second game", { exact: true })).toBeVisible();
  await expect(latest.getByText("First game", { exact: true })).toHaveCount(0);
  await input.fill("123");
  await input.press("Enter");
  await expect(error).toContainText("complete 14-digit ticket barcode");
  await page.clock.runFor(3999);
  await expect(error).toBeVisible();
  await page.clock.runFor(1);
  await expect(error).toHaveCount(0);
  expect(sales).toBe(3);
});

test("rapid ticket scans are queued in order while the first server check is pending", async ({ context, page, baseURL }) => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires development offline auth with matching JWT_SECRET and E2E_REPORT_SECRET.");
  const token = await new SignJWT({
    userId: "pos-operator", storeId: "pos-store", storeName: "POS Store",
    name: "POS Operator", email: "pos@example.test", role: "MANAGER", grantedPermissions: [],
    shiftId: "shift", shiftNumber: 1, terminalId: "T1", loginSessionId: "login-pos-operator",
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
  await context.addCookies([{ name: "lottoops_session", value: token, url: baseURL! }]);
  await page.route("**/api/pos/inventory-status", (route) => route.fulfill({ json: { alerts: [] } }));
  await page.route("**/api/pos/reconciliation?*", (route) => route.fulfill({ json: { items: [] } }));
  const scanned: string[] = [];
  const posReady = page.waitForResponse("**/api/pos/reconciliation?*");
  await page.route("**/api/packs/check-serial", async (route) => {
    const serialNumber = route.request().postDataJSON().serialNumber as string;
    scanned.push(serialNumber);
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ json: {
      id: "pack", saleId: `sale-${scanned.length}`, shiftId: "shift", ticketBarcode: serialNumber,
      gameName: `Game ${scanned.length}`, salesAmount: 1, nextTicketNumber: scanned.length + 1,
      slot: { slotNumber: "1" }, packStatus: "ACTIVE",
    } });
  });
  await page.goto("/pos?shiftId=shift&terminal=T1");
  await posReady;
  const input = page.getByPlaceholder("Scan or enter 14 digits");
  await expect(input).toBeVisible();
  await expect(page.getByText("Online", { exact: true })).toBeVisible();
  await input.fill("12341234567001");
  await expect(page.getByRole("button", { name: "Track", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Track", exact: true }).click();
  await expect.poll(() => scanned.length).toBe(1);
  await expect(input).toBeEnabled();
  await input.fill("12341234567002");
  await expect(page.getByRole("button", { name: "Track", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Track", exact: true }).click();
  await expect.poll(() => scanned.length).toBe(2);
  await expect.poll(() => page.locator("aside").getByText("12341234567002", { exact: true }).count()).toBe(1);
  expect(scanned).toEqual(["12341234567001", "12341234567002"]);
});

test("offline wrong-ticket replay is consumed without manager reconciliation and later valid scans continue", async ({ context, page, baseURL }) => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires development offline auth with matching JWT_SECRET and E2E_REPORT_SECRET.");
  const token = await new SignJWT({
    userId: "pos-operator", storeId: "pos-store", storeName: "POS Store",
    name: "POS Operator", email: "pos@example.test", role: "MANAGER", grantedPermissions: [],
    shiftId: "shift", shiftNumber: 1, terminalId: "T1", loginSessionId: "login-pos-operator",
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
  await context.addCookies([{ name: "lottoops_session", value: token, url: baseURL! }]);
  await page.route("**/api/pos/inventory-status", (route) => route.fulfill({ json: { alerts: [] } }));
  let reconciliationPosts = 0;
  await page.route("**/api/pos/reconciliation**", async (route) => {
    if (route.request().method() === "POST") reconciliationPosts++;
    await route.fulfill({ json: { items: [] } });
  });
  const scans: string[] = [];
  let announceSecondScan!: () => void;
  const secondScanStarted = new Promise<void>((resolve) => { announceSecondScan = resolve; });
  let releaseSecondResponse!: () => void;
  const secondResponseReleased = new Promise<void>((resolve) => { releaseSecondResponse = resolve; });
  await page.route("**/api/packs/check-serial", async (route) => {
    const serialNumber = route.request().postDataJSON().serialNumber as string;
    scans.push(serialNumber);
    if (scans.length === 1) {
      await route.fulfill({ status: 409, json: {
        code: "TICKET_SEQUENCE_MISMATCH", noSale: true, packId: "pack",
        expectedTicket: 50, scannedTicketNumber: 1,
        error: "Wrong ticket scanned in this shift. No ticket was tracked. The system expected ticket 50; ticket 1 was scanned.",
      } });
      return;
    }
    announceSecondScan();
    await secondResponseReleased;
    await route.fulfill({ json: {
      id: "pack", saleId: "sale-after-mismatch", shiftId: "shift", ticketBarcode: serialNumber,
      gameName: "Correct ticket", salesAmount: 1, nextTicketNumber: 51,
      slot: { slotNumber: "1" }, packStatus: "ACTIVE",
    } });
  });

  await page.goto("/pos?shiftId=shift&terminal=T1");
  const input = page.getByPlaceholder("Scan or enter 14 digits");
  await expect(input).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText("Offline mode")).toBeVisible();
  await input.fill("12341234567001");
  await input.press("Enter");
  await input.fill("12341234567002");
  await input.press("Enter");
  await expect(page.getByRole("button", { name: "2 scans waiting to sync" })).toBeVisible();

  await context.setOffline(false);
  await secondScanStarted;
  const error = page.getByRole("alert").filter({ hasText: "Ticket scan error" });
  await expect(error).toContainText("Wrong ticket scanned in this shift. No ticket was tracked.");
  await expect(error).toContainText("Expected ticket 50; ticket 1 was scanned");
  await expect(error).not.toContainText("manager");
  await expect.poll(() => scans.length).toBe(2);
  releaseSecondResponse();
  await expect(page.getByRole("status").filter({ hasText: "Correct ticket" })).toContainText("Ticket Tracked Successfully");
  await expect(page.getByText("Ticket Value", { exact: true })).toBeVisible();
  await expect(error).toHaveCount(0);
  await expect(page.getByRole("button", { name: /scans waiting to sync|conflict.*needs review/ })).toHaveCount(0);
  expect(reconciliationPosts).toBe(0);
});

test("remembered manager stays signed in beyond the short inactivity cutoff", async ({ context, page, baseURL }) => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires a test JWT secret for the local offline-auth session.");
  const token = await new SignJWT({
    userId: "pos-operator", storeId: "pos-store", storeName: "POS Store",
    name: "POS Operator", email: "pos@example.test", role: "MANAGER", grantedPermissions: [], rememberMe: true,
    shiftId: "shift", shiftNumber: 1, terminalId: "T1", loginSessionId: "login-pos-operator",
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d")
    .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
  await context.addCookies([{ name: "lottoops_session", value: token, url: baseURL! }]);
  await page.route("**/api/pos/inventory-status", (route) => route.fulfill({ json: { alerts: [] } }));
  await page.route("**/api/pos/reconciliation?*", (route) => route.fulfill({ json: { items: [] } }));
  const now = new Date();
  await page.clock.install({ time: now });
  await page.goto("/pos?shiftId=shift&terminal=T1");
  await expect(page.getByRole("heading", { name: "Track Tickets" })).toBeVisible();
  await page.clock.runFor(11 * 60 * 1000);
  await expect(page).toHaveURL(/\/pos\?shiftId=shift&terminal=T1$/);
  await expect(page.getByRole("heading", { name: "Track Tickets" })).toBeVisible();
  await expect(page.getByRole("alertdialog", { name: "Inactivity warning" })).toHaveCount(0);
});

test("sign out clears session and gives the next user an isolated, revalidated dashboard", async ({ context, page, baseURL }) => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires a test JWT secret for the local offline-auth session.");
  const secret = new TextEncoder().encode(process.env.E2E_REPORT_SECRET);
  const firstToken = await new SignJWT({
    userId: "pos-operator", storeId: "pos-store", storeName: "POS Store",
    name: "First Operator", email: "first@example.test", role: "MANAGER", grantedPermissions: [],
    shiftId: "shift", shiftNumber: 1, terminalId: "T1", loginSessionId: "login-first-operator",
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(secret);
  const secondToken = await new SignJWT({
    userId: "second-operator", storeId: "pos-store", storeName: "POS Store",
    name: "Second Operator", email: "second@example.test", role: "MANAGER", grantedPermissions: [],
    shiftId: "shift", shiftNumber: 1, terminalId: "T1", loginSessionId: "login-second-operator",
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(secret);
  await context.addCookies([
    { name: "lottoops_session", value: firstToken, url: baseURL! },
    { name: "lottoops_mfa_challenge", value: "mfa-test", url: baseURL! },
    { name: "lottoops_platform_session_backup", value: "support-test", url: baseURL! },
  ]);
  await page.route("**/api/pos/inventory-status", (route) => route.fulfill({ json: { alerts: [] } }));
  await page.route("**/api/pos/reconciliation?*", (route) => route.fulfill({ json: { items: [] } }));
  const firstResponse = await page.goto("/pos?shiftId=shift&terminal=T1");
  await expect(page.getByRole("heading", { name: "Track Tickets" })).toBeVisible();
  expect(firstResponse?.headers()["cache-control"]).toMatch(/no-cache|no-store/);
  expect(firstResponse?.headers()["cache-control"]).toContain("must-revalidate");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  const cookies = await context.cookies(baseURL!);
  expect(cookies.map((cookie) => cookie.name)).not.toContain("lottoops_session");
  expect(cookies.map((cookie) => cookie.name)).not.toContain("lottoops_mfa_challenge");
  expect(cookies.map((cookie) => cookie.name)).not.toContain("lottoops_platform_session_backup");
  await page.goBack();
  await expect(page.getByRole("heading", { name: /sign in|welcome/i })).toBeVisible();

  await context.addCookies([{ name: "lottoops_session", value: secondToken, url: baseURL! }]);
  const secondResponse = await page.goto("/pos?shiftId=shift&terminal=T1");
  await expect(page.getByText("Second Operator · scan-first POS terminal")).toBeVisible();
  await expect(page.getByText("First Operator · scan-first POS terminal")).toHaveCount(0);
  expect(secondResponse?.headers()["cache-control"]).toMatch(/no-cache|no-store/);
  expect(secondResponse?.headers()["cache-control"]).toContain("must-revalidate");
});
