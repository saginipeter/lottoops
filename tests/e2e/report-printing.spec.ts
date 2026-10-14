import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";

test.describe("Data-only report documents", () => {
  test.skip(!process.env.E2E_REPORT_SECRET, "Run against a development server with matching JWT_SECRET and E2E_REPORT_SECRET and offline auth enabled.");

  test.beforeEach(async ({ context, baseURL, page }) => {
    const token = await new SignJWT({
      userId: "report-operator", storeId: "report-store", storeName: "Report Store",
      name: "Report Operator", email: "operator@example.test", role: "MANAGER", grantedPermissions: [],
    }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.E2E_REPORT_SECRET));
    await context.addCookies([{ name: "lottoops_session", value: token, url: baseURL! }]);
    await page.addInitScript(() => {
      const state = window as typeof window & { printCalls?: Array<{ topLevel: boolean; html: string }> };
      state.printCalls = [];
      window.print = () => {
        const parentState = window.top as typeof state;
        parentState.printCalls?.push({ topLevel: window === window.top, html: document.body.innerHTML });
      };
    });
    await page.route("**/api/reports/shifts?*", (route) => route.fulfill({
      json: { summary: { totalGross: 0, totalCogs: 0, totalNet: 0, totalTickets: 0, avgMarginPct: 0, shiftCount: 0 }, shifts: [], dailyTotals: [], gamePerformance: [] },
    }));
  });

  test("preview and direct print contain only the same escaped activity data", async ({ page }) => {
    await page.route("**/api/reports/activity?*", (route) => route.fulfill({
      json: { logs: [{
        id: 1, action: "RECEIVED", entityType: "PACK", performedById: "receiver",
        performedByName: "Receiver Name", terminalId: "Terminal A",
        detail: '<script>window.reportAttack = true</script>', createdAt: "2026-10-14T09:00:00Z",
      }] },
    }));
    await page.goto("/admin/reports");
    await page.getByLabel("Choose report").selectOption("activity");
    await expect(page.getByText("Receiver Name", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "View Report", exact: true }).click();
    const preview = page.frameLocator('iframe[title$=" preview"]');
    await expect(preview.getByText("Receiver Name", { exact: true })).toBeVisible();
    await expect(preview.getByText("<script>window.reportAttack = true</script>", { exact: true })).toBeVisible();
    expect(await preview.locator("nav, aside, button, input, script").count()).toBe(0);
    const previewHtml = await preview.locator("body").innerHTML();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Print Report", exact: true }).click();
    await expect.poll(() => page.evaluate(() =>
      (window as typeof window & { printCalls?: unknown[] }).printCalls?.length ?? 0,
    )).toBe(1);
    const calls = await page.evaluate(() =>
      (window as typeof window & { printCalls?: Array<{ topLevel: boolean; html: string }> }).printCalls ?? [],
    );
    expect(calls[0].topLevel).toBe(false);
    expect(calls[0].html).toBe(previewHtml);
    expect(calls[0].html).not.toMatch(/<nav|<aside|<button|<input|<script/);
  });

  test("each shipment action prints only its transaction and reuses the preview snapshot", async ({ page }) => {
    const shipments = ["A", "B"].map((id) => ({
      id, invoiceNumber: `INV-${id}`, shipmentConfirmationNumber: `CONF-${id}`,
      shipmentDate: "2026-10-14", expectedPacks: 1, scannedPacks: 1,
      status: "RECEIVED", createdAt: "2026-10-14T09:00:00Z",
      receivedBy: { name: `Receiver ${id}` }, _count: { packs: 1 },
    }));
    await page.route("**/api/shipments?*", (route) => route.fulfill({
      json: { shipments, page: 1, pageSize: 20, total: 2, totalPages: 1 },
    }));
    let detailRequests = 0;
    await page.route(/\/api\/shipments\/[AB]$/, (route) => {
      const id = route.request().url().split("/").at(-1)!;
      detailRequests++;
      return route.fulfill({
        json: {
          ...shipments.find((shipment) => shipment.id === id),
          invoicePhoto: null, confirmationReceiptPhoto: null, confirmedAt: "2026-10-14T10:00:00Z",
          supplierName: `Supplier ${id} snapshot ${detailRequests}`,
          store: { name: "Report Store", storeNumber: "1", address: null, phone: null, timezone: "UTC" },
          packs: [{ id: `pack-${id}`, gameNumber: "1234", packNumber: id, serialNumber: `serial-${id}`, ticketPrice: 1, ticketQuantity: 100, firstTicket: 1, cost: 95, retailValue: 100, status: "BACK_STOCK", receivedAt: "2026-10-14T09:00:00Z", game: { name: `Game ${id}` } }],
        },
      });
    });
    await page.goto("/admin/reports");
    await page.getByLabel("Choose report").selectOption("receiving-shipments");
    const first = page.getByRole("row").filter({ has: page.getByText("INV-A", { exact: true }) });
    await first.getByRole("button", { name: "View Report", exact: true }).click();
    const preview = page.frameLocator('iframe[title$=" preview"]');
    await expect(preview.getByText("Supplier A snapshot 1", { exact: true })).toBeVisible();
    await expect(preview.getByText("serial-B", { exact: false })).toHaveCount(0);
    const previewHtml = await preview.locator("body").innerHTML();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await first.getByRole("button", { name: "Print Report", exact: true }).click();
    await expect.poll(() => page.evaluate(() =>
      (window as typeof window & { printCalls?: unknown[] }).printCalls?.length ?? 0,
    )).toBe(1);
    expect(detailRequests).toBe(1);
    const html = await page.evaluate(() =>
      (window as typeof window & { printCalls?: Array<{ html: string }> }).printCalls?.[0].html,
    );
    expect(html).toBe(previewHtml);
    expect(html).not.toContain("INV-B");
    const second = page.getByRole("row").filter({ has: page.getByText("INV-B", { exact: true }) });
    await second.getByRole("button", { name: "Print Report", exact: true }).click();
    await expect.poll(() => page.evaluate(() =>
      (window as typeof window & { printCalls?: unknown[] }).printCalls?.length ?? 0,
    )).toBe(2);
    expect(await page.getByRole("dialog").count()).toBe(0);
    expect(detailRequests).toBe(2);
    expect(await page.evaluate(() =>
      (window as typeof window & { printCalls?: Array<{ html: string }> }).printCalls?.[1].html,
    )).toContain("INV-B");
  });
});
