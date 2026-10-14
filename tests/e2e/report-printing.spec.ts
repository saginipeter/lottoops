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

  test("simple shift report prints only the selected shift statistics and variance", async ({ page }) => {
    await page.route("**/api/reports/shifts?*", (route) => route.fulfill({
      json: {
        summary: { totalGross: 10, totalCogs: 9.5, totalNet: 0.5, totalTickets: 10, avgMarginPct: 5, shiftCount: 1 },
        shifts: [{
          id: "closed-shift", storeName: "Report Store", terminalId: "Terminal A",
          openedAt: "2026-10-14T08:00:00Z", closedAt: "2026-10-14T12:00:00Z",
          openedBy: "Opening Operator", closedBy: "Closing Operator",
          grossSales: 10, cogs: 9.5, netMargin: 0.5, marginPct: 5, ticketsSold: 10,
          gameBreakdown: [{ name: "Game A", tickets: 10, sales: 10, cost: 9.5 }],
          packSales: [{ pack: "pack-A", game: "Game A", display: "1", beginning: 100, ending: 90, tickets: 10, sales: 10 }],
          audit: [{ pack: "pack-A", display: "1", direction: "FIRST", beginningExpected: 1, beginning: 1, expected: 11, ending: 12 }],
          auditOpenedBy: "Opening Operator", auditClosedBy: "Closing Operator",
          auditOpenedAt: "2026-10-14T08:00:00Z", auditClosedAt: "2026-10-14T12:00:00Z",
          cash: { openingCash: 100, expectedCash: 110, countedCash: 108, cashVariance: -2, reconciledAt: "2026-10-14T12:00:00Z", reconciledBy: "Closing Operator" },
        }, {
          id: "other-shift", storeName: "Report Store", terminalId: "Terminal B",
          openedAt: "2026-10-14T13:00:00Z", closedAt: "2026-10-14T17:00:00Z",
          openedBy: "Other Operator", closedBy: "Other Operator",
          grossSales: 999, cogs: 0, netMargin: 999, marginPct: 100, ticketsSold: 999,
          gameBreakdown: [], packSales: [], audit: [],
          auditOpenedBy: null, auditClosedBy: null, auditOpenedAt: null, auditClosedAt: null,
          cash: { openingCash: null, expectedCash: null, countedCash: null, cashVariance: null, reconciledAt: null, reconciledBy: null },
        }],
        dailyTotals: [], gamePerformance: [],
      },
    }));
    await page.goto("/admin/reports");
    const selected = page.getByRole("row").filter({ has: page.getByText("Opening Operator", { exact: true }) }).first();
    await selected.getByRole("button", { name: "View Report", exact: true }).click();
    const preview = page.frameLocator('iframe[title$=" preview"]');
    await expect(preview.getByText("closed-shift", { exact: true })).toBeVisible();
    await expect(preview.getByText("Opening Operator", { exact: true }).first()).toBeVisible();
    await expect(preview.getByText("Closing Operator", { exact: true }).first()).toBeVisible();
    await expect(preview.getByRole("heading", { name: "End of Shift Report" })).toBeVisible();
    await expect(preview.getByRole("row").filter({ hasText: "Tickets sold" })).toContainText("10");
    await expect(preview.getByRole("row").filter({ hasText: "Recorded cash variance" })).toContainText("-$2.00");
    await expect(preview.getByRole("row").filter({ hasText: "1 / pack-A" })).toHaveText("1 / pack-A11121");
    expect(await preview.locator("nav, aside, button, input, script").count()).toBe(0);
    const previewHtml = await preview.locator("body").innerHTML();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await selected.getByRole("button", { name: "Print Report", exact: true }).click();
    await expect.poll(() => page.evaluate(() =>
      (window as typeof window & { printCalls?: unknown[] }).printCalls?.length ?? 0,
    )).toBe(1);
    const call = await page.evaluate(() =>
      (window as typeof window & { printCalls?: Array<{ topLevel: boolean; html: string }> }).printCalls?.[0],
    );
    expect(call?.topLevel).toBe(false);
    expect(call?.html).toBe(previewHtml);
    expect(call?.html).not.toContain("other-shift");
    expect(call?.html).not.toContain("Other Operator");
  });
});
