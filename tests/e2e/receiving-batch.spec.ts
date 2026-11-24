import { test, expect, type BrowserContext } from "@playwright/test";
import { SignJWT } from "jose";

async function signInStore(context: BrowserContext, baseURL: string) {
  const token = await new SignJWT({
    userId: "receiving-batch-operator",
    storeId: "receiving-batch-store",
    storeName: "Receiving Batch Store",
    name: "Inventory Operator",
    email: "operator@example.test",
    role: "MANAGER",
    grantedPermissions: [],
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
  await context.addCookies([{ name: "lottoops_session", value: token, url: baseURL }]);
}

test.describe("batch shipment receiving", () => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Requires offline development auth with matching JWT_SECRET and E2E_REPORT_SECRET.");

  test("scans stay continuous, prompts last 4.5 seconds, and selected packs submit together with full barcodes", async ({ page, context, baseURL }) => {
    await signInStore(context, baseURL!);
    await page.clock.install();
    await page.addInitScript(() => {
      localStorage.setItem("lottoops-receive-draft-v1:receiving-batch-store", JSON.stringify({
        step: 2,
        shipment: {
          id: "shipment-batch-test",
          invoiceNumber: "BATCH-INV-1",
          invoicePhoto: "https://example.test/invoice.png",
          shipmentDate: "2026-11-17",
          receivedBy: "Inventory Operator",
          expectedPacks: 4,
          expectedRetailValue: 0,
          scannedPacks: 0,
          status: "IN_PROGRESS",
        },
        packs: [],
        scanDraft: {
          barcode: "",
          gameNumber: "",
          packNumber: "",
          firstTicket: "",
          ticketPrice: 10,
          ticketQuantity: 50,
          packImage: "",
        },
      }));
    });

    await page.route("**/api/shipments/shipment-batch-test", (route) => route.fulfill({ json: {
      id: "shipment-batch-test",
      receivedBy: { name: "Inventory Operator" },
      supplierName: "Lottery Supplier",
      supplierDetails: "",
      expectedInventoryCost: null,
    } }));
    const detectedGameRequests: string[] = [];
    await page.route("**/api/packs/detect-game?*", async (route) => {
      detectedGameRequests.push(new URL(route.request().url()).searchParams.get("gameNumber") ?? "");
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({ json: {
        found: true,
        source: "store",
        gameNumber: "2424",
        name: "Test Scratch Game",
        price: 10,
        ticketsPerPack: 50,
      } });
    });

    const batchRequests: Array<{ shipmentId: string; packs: Array<{ barcode: string; packNumber: string }> }> = [];
    await page.route("**/api/packs/batch", async (route) => {
      const body = route.request().postDataJSON() as { shipmentId: string; packs: Array<{
        barcode: string;
        gameNumber: string;
        packNumber: string;
        firstTicket: number;
        ticketPrice: number;
        ticketQuantity: number;
        packImage: string | null;
      }> };
      batchRequests.push(body);
      const savedPacks = body.packs.map((pack, index) => ({
        id: `saved-${pack.barcode}`,
        serialNumber: pack.barcode,
        gameNumber: pack.gameNumber,
        packNumber: pack.packNumber,
        firstTicket: pack.firstTicket,
        ticketPrice: pack.ticketPrice,
        ticketQuantity: pack.ticketQuantity,
        packImage: pack.packImage,
        status: "RECEIVING",
        game: {
          id: "game-2424",
          gameNumber: pack.gameNumber,
          name: "Test Scratch Game",
          price: pack.ticketPrice,
          ticketsPerPack: pack.ticketQuantity,
        },
        createdAt: new Date(index),
      }));
      await route.fulfill({ status: 201, json: { success: true, packs: savedPacks } });
    });

    await page.goto("/inventory/receive/step/2");
    const barcodeInput = page.getByPlaceholder("Scan Pack");
    const notice = page.getByRole("status").filter({ hasText: /added to the scanned list/ });

    async function scan(barcode: string) {
      await barcodeInput.pressSequentially(barcode);
      await expect(barcodeInput).toHaveValue("");
    }

    await scan("24240089877001");
    await expect(notice).toBeVisible();
    await expect(barcodeInput).toBeFocused();
    await barcodeInput.press("Enter");
    await expect.poll(() => detectedGameRequests.length).toBe(1);
    await page.clock.fastForward(3000);
    await expect(notice).toBeVisible();

    // These scans are entered faster than the delayed game lookup. The input
    // clears immediately and the queue preserves every barcode in order.
    await scan("24240089878002");
    await scan("24240089879003");
    await scan("24240089880004");
    await expect.poll(() => detectedGameRequests.length).toBe(4);
    for (const serial of ["24240089877", "24240089878", "24240089879", "24240089880"]) {
      await expect(page.getByText(serial, { exact: true })).toBeVisible();
    }
    await expect(notice).toBeVisible();
    const noticeBounds = await notice.boundingBox();
    expect(noticeBounds?.y).toBeLessThanOrEqual(24);

    await scan("24240089881005");
    const scanError = page.getByRole("alert").filter({ hasText: "This shipment has space for only 4 packs." });
    await expect(scanError).toBeVisible();
    const errorBounds = await scanError.boundingBox();
    expect(errorBounds?.y).toBeLessThanOrEqual(24);
    await page.clock.runFor(28_000);
    await expect(scanError).toBeVisible();
    await scanError.getByRole("button", { name: "Dismiss receiving error" }).click();
    await expect(scanError).toHaveCount(0);

    await scan("24240089877001");
    const duplicateError = page.getByRole("alert").filter({ hasText: "has already been scanned for this shipment." });
    await expect(duplicateError).toBeVisible();
    await page.clock.runFor(30_000);
    await expect(duplicateError).toHaveCount(0);

    const rowOne = page.getByLabel("Select pack 24240089877");
    const rowTwo = page.getByLabel("Select pack 24240089878");
    await rowTwo.uncheck();
    await page.getByLabel("Select pack 24240089879").uncheck();
    await page.getByLabel("Select pack 24240089880").uncheck();
    await expect(rowOne).toBeChecked();
    await page.getByRole("button", { name: /Add Selected to Shipment/ }).click();
    await expect.poll(() => batchRequests.length).toBe(1);
    expect(batchRequests[0]?.shipmentId).toBe("shipment-batch-test");
    expect(batchRequests[0]?.packs.map((pack) => pack.barcode)).toEqual(["24240089877"]);
    await expect(page.getByText("24240089877", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Select pack 24240089877")).toBeDisabled();

    let removedPackId = "";
    await page.route("**/api/packs", async (route) => {
      if (route.request().method() !== "DELETE") return route.continue();
      removedPackId = route.request().postDataJSON().packId;
      await route.fulfill({ json: { ok: true, removed: true } });
    });
    await page.getByRole("button", { name: "Remove pack 24240089877" }).click();
    await expect.poll(() => removedPackId).toBe("saved-24240089877");
    await expect(page.getByText("24240089877", { exact: true })).toHaveCount(0);

    // Clear the remaining draft selection, then use the master checkbox to select
    // all remaining packs and send them in one request.
    await page.getByLabel("Select pack 24240089878").uncheck();
    await page.getByLabel("Select pack 24240089879").uncheck();
    await page.getByLabel("Select pack 24240089880").uncheck();
    const selectAll = page.getByLabel("Select all scanned packs");
    await selectAll.check();
    await expect(page.getByLabel("Select pack 24240089878")).toBeChecked();
    await expect(page.getByLabel("Select pack 24240089879")).toBeChecked();
    await expect(page.getByLabel("Select pack 24240089880")).toBeChecked();
    await page.getByRole("button", { name: /Add Selected to Shipment/ }).click();
    await expect.poll(() => batchRequests.length).toBe(2);
    expect(batchRequests[1]?.packs.map((pack) => pack.barcode)).toEqual([
      "24240089878",
      "24240089879",
      "24240089880",
    ]);

    await expect(page.getByText("24240089878", { exact: true })).toBeVisible();
    await expect(page.getByText("24240089879", { exact: true })).toBeVisible();
    await expect(page.getByText("24240089880", { exact: true })).toBeVisible();
    await page.clock.fastForward(4501);
    await expect(notice).toBeHidden();
  });

  test("receiving form uses Order Date terminology", async ({ page, context, baseURL }) => {
    await signInStore(context, baseURL!);
    await page.goto("/inventory/receive/step/1");
    await expect(page.getByText("Order Date", { exact: true })).toBeVisible();
    await expect(page.getByText("Shipment date", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toContainText("Prompt 1 of 4");
    await expect(page.getByRole("dialog")).toContainText("invoice tracking number and select the Order Date");
    await page.locator("body").press("Enter");
    await expect(page.getByRole("dialog")).toContainText("expected pack count and inventory cost");
    await page.getByRole("button", { name: "OK · Next" }).click();
    await expect(page.getByRole("dialog")).toContainText("upload the invoice photo and confirmation receipt");
  });

  test("empty scanner Enter advances the final guide prompt using the existing review action", async ({ page, context, baseURL }) => {
    await signInStore(context, baseURL!);
    await page.addInitScript(() => {
      localStorage.setItem("lottoops-receive-draft-v1:receiving-batch-store", JSON.stringify({
        step: 2,
        shipment: {
          id: "shipment-guide-test", invoiceNumber: "GUIDE-INV", invoicePhoto: "https://example.test/invoice.png",
          confirmationReceiptPhoto: "https://example.test/receipt.png", shipmentConfirmationNumber: "GUIDE-CONF",
          shipmentDate: "2026-11-23", receivedBy: "Inventory Operator", expectedPacks: 1,
          expectedRetailValue: 475, scannedPacks: 1, status: "IN_PROGRESS",
        },
        packs: [{
          id: "saved-guide-pack", serialNumber: "24240089877", gameNumber: "2424", packNumber: "0089877",
          firstTicket: 1, ticketPrice: 10, ticketQuantity: 50, packImage: null, status: "RECEIVING",
          game: { id: "game-guide", gameNumber: "2424", name: "Guide Test Game", price: 10, ticketsPerPack: 50 },
        }],
        scanDraft: { barcode: "", gameNumber: "", packNumber: "", firstTicket: "", ticketPrice: 10, ticketQuantity: 50, packImage: "" },
      }));
    });
    await page.route("**/api/shipments/shipment-guide-test", (route) => route.fulfill({ json: {
      id: "shipment-guide-test", receivedBy: { name: "Inventory Operator" }, expectedInventoryCost: 475,
    } }));
    let syncRequest = false;
    await page.route("**/api/packs", async (route) => {
      if (route.request().method() !== "DELETE") return route.continue();
      syncRequest = route.request().postDataJSON().shipmentId === "shipment-guide-test";
      await route.fulfill({ json: { ok: true, removed: 0 } });
    });

    await page.goto("/inventory/receive/step/2");
    const guide = page.getByRole("dialog");
    await expect(guide).toContainText("Prompt 4 of 4");
    await expect(guide.getByRole("button", { name: "OK · Continue to review" })).toBeEnabled();
    await page.getByPlaceholder("Scan Pack").press("Enter");
    await expect.poll(() => syncRequest).toBe(true);
    await expect(page.getByText("Review shipment", { exact: true })).toBeVisible();
    await expect(page.getByText("Step 3 of 4", { exact: true })).toBeVisible();
  });
});
