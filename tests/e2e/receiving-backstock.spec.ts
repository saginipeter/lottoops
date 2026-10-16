import { test, expect, type BrowserContext } from "@playwright/test";
import { SignJWT } from "jose";

async function signInStore(context: BrowserContext, baseURL: string, storeId = "inventory-store") {
  const token = await new SignJWT({
    userId: `operator-${storeId}`, storeId, storeName: storeId,
    name: "Inventory Operator", email: "operator@example.test", role: "MANAGER", grantedPermissions: [],
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
  await context.addCookies([{ name: "lottoops_session", value: token, url: baseURL }]);
}

test.describe("Receiving and backstock regressions", () => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires offline development auth with matching JWT_SECRET and E2E_REPORT_SECRET.");

  test.beforeEach(async ({ context, baseURL }) => {
    await signInStore(context, baseURL!);
  });

  for (const entry of ["/inventory/receive", "/inventory/receive/step/1"]) {
    test(`unfinished shipment details stay in their own store via ${entry}`, async ({ page, context, baseURL }) => {
      await page.goto(entry);
      await page.getByPlaceholder("Enter invoice number").fill("STORE-A-INVOICE");
      await page.getByPlaceholder("Enter confirmation number").fill("STORE-A-CONFIRMATION");
      await page.getByPlaceholder("Enter inventory cost").fill("95.50");
      await page.reload();
      await expect(page.getByPlaceholder("Enter invoice number")).toHaveValue("STORE-A-INVOICE");

      await context.request.post("/api/auth/logout");
      await signInStore(context, baseURL!, "other-store");
      await page.goto(entry);
      await expect(page.getByPlaceholder("Enter invoice number")).toHaveValue("");
      await expect(page.getByPlaceholder("Enter confirmation number")).toHaveValue("");
      await expect(page.getByPlaceholder("Enter inventory cost")).toHaveValue("");
      await expect(page.getByLabel(/Received by/)).toHaveValue("Inventory Operator");
      await page.getByPlaceholder("Enter invoice number").fill("STORE-B-INVOICE");

      await context.request.post("/api/auth/logout");
      await signInStore(context, baseURL!);
      await page.goto(entry);
      await expect(page.getByPlaceholder("Enter invoice number")).toHaveValue("STORE-A-INVOICE");
      await expect(page.getByPlaceholder("Enter confirmation number")).toHaveValue("STORE-A-CONFIRMATION");
      await expect(page.getByPlaceholder("Enter inventory cost")).toHaveValue("95.5");

      await page.route("**/api/shipments", (route) => route.fulfill({ json: { ok: true } }));
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Clear Form Data" }).click();
      await expect(page.getByPlaceholder("Enter invoice number")).toHaveValue("");
      await signInStore(context, baseURL!, "other-store");
      await page.goto(entry);
      await expect(page.getByPlaceholder("Enter invoice number")).toHaveValue("STORE-B-INVOICE");
    });
  }

  test("scanned packs and scan inputs are restored only for their store", async ({ page, context, baseURL }) => {
    await page.goto("/inventory/receive");
    await expect(page.getByPlaceholder("Enter invoice number")).toBeVisible();
    await page.evaluate(() => {
      const key = "lottoops-receive-draft-v1:inventory-store";
      const draft = JSON.parse(localStorage.getItem(key)!);
      draft.step = 2;
      draft.shipment.invoiceNumber = "STORE-A-INVOICE";
      draft.scanDraft.barcode = "24240089877001";
      draft.scanDraft.gameNumber = "2424";
      draft.packs = [{
        id: "draft-store-a", serialNumber: "24240089877", firstTicket: 1,
        ticketPrice: 10, ticketQuantity: 50, status: "BACK_STOCK",
        game: { gameNumber: "2424", name: "Store A draft game" },
      }];
      localStorage.setItem(key, JSON.stringify(draft));
    });
    await page.reload();
    await expect(page.getByText("Store A draft game", { exact: true })).toBeVisible();
    await expect(page.getByText("Step 2 of 4", { exact: true })).toBeVisible();

    await context.request.post("/api/auth/logout");
    await signInStore(context, baseURL!, "other-store");
    await page.goto("/inventory/receive/step/2");
    await expect(page.getByText("No packs scanned yet.", { exact: true })).toBeVisible();
    await expect(page.getByText("Store A draft game", { exact: true })).toHaveCount(0);
    const otherDraft = await page.evaluate(() => JSON.parse(localStorage.getItem("lottoops-receive-draft-v1:other-store")!));
    expect(otherDraft.scanDraft.barcode).toBe("");
    expect(otherDraft.packs).toEqual([]);
    expect(otherDraft.shipment.invoiceNumber).toBe("");

    await signInStore(context, baseURL!);
    await page.goto("/inventory/receive");
    await expect(page.getByText("Store A draft game", { exact: true })).toBeVisible();
    await expect(page.getByText("Step 2 of 4", { exact: true })).toBeVisible();
    const restoredDraft = await page.evaluate(() => JSON.parse(localStorage.getItem("lottoops-receive-draft-v1:inventory-store")!));
    expect(restoredDraft.scanDraft.barcode).toBe("24240089877001");
  });

  test("legacy drafts without store ownership are discarded, not migrated", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("lottoops-receive-draft-v1", JSON.stringify({
        step: 2, shipment: { id: "foreign-shipment", invoiceNumber: "FOREIGN-INVOICE" },
        scanDraft: { barcode: "24240089877001" },
      }));
    });
    const shipmentRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/shipments/")) shipmentRequests.push(request.url());
    });
    await page.goto("/inventory/receive");
    await expect(page.getByPlaceholder("Enter invoice number")).toHaveValue("");
    await expect(page.getByText("Step 1 of 4", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("lottoops-receive-draft-v1"))).toBeNull();
    expect(shipmentRequests).toEqual([]);
  });

  test("offline POS sales cannot replay in another store using the same terminal", async ({ page, context, baseURL }) => {
    await page.route("**/api/pos/inventory-status", (route) => route.fulfill({ json: { alerts: [] } }));
    await page.route("**/api/pos/reconciliation?*", (route) => route.fulfill({ json: { items: [] } }));
    let allowSales = false;
    const replayed: string[] = [];
    await page.route("**/api/packs/check-serial", (route) => {
      replayed.push(route.request().postDataJSON().serialNumber);
      return allowSales ? route.fulfill({ json: { status: "sold" } }) : route.abort("failed");
    });
    await page.goto("/pos");
    const input = page.getByPlaceholder("Scan or enter 14 digits");
    await input.fill("12341234567001");
    await input.press("Enter");
    await expect(page.getByText("1 sale waiting to sync", { exact: true })).toBeVisible();
    await page.evaluate(() => {
      localStorage.setItem("lottoops:pos-offline-queue:POS-01", JSON.stringify([{
        id: "legacy", barcode: "99991234567001", queuedAt: new Date().toISOString(), attempts: 0,
      }]));
    });

    await context.request.post("/api/auth/logout");
    await signInStore(context, baseURL!, "other-store");
    replayed.length = 0;
    await page.goto("/pos");
    await expect(input).toBeVisible();
    await expect(page.getByText("1 sale waiting to sync", { exact: true })).toHaveCount(0);
    expect(replayed).toEqual([]);
    await input.fill("56781234567001");
    await input.press("Enter");
    await expect(page.getByText("1 sale waiting to sync", { exact: true })).toBeVisible();
    const queues = await page.evaluate(() => ({
      a: JSON.parse(localStorage.getItem("lottoops:pos-offline-queue:inventory-store:POS-01")!),
      b: JSON.parse(localStorage.getItem("lottoops:pos-offline-queue:other-store:POS-01")!),
    }));
    expect(queues.a.map((entry: { barcode: string }) => entry.barcode)).toEqual(["12341234567001"]);
    expect(queues.b.map((entry: { barcode: string }) => entry.barcode)).toEqual(["56781234567001"]);

    await context.request.post("/api/auth/logout");
    await signInStore(context, baseURL!);
    allowSales = true;
    replayed.length = 0;
    await page.goto("/pos");
    await expect.poll(() => [...replayed]).toEqual(["12341234567001"]);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("lottoops:pos-offline-queue:inventory-store:POS-01")!))).toEqual([]);
    const otherQueue = await page.evaluate(() => JSON.parse(localStorage.getItem("lottoops:pos-offline-queue:other-store:POS-01")!));
    expect(otherQueue.map((entry: { barcode: string }) => entry.barcode)).toEqual(["56781234567001"]);
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
