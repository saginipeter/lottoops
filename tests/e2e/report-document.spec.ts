import { test, expect } from "@playwright/test";
import { renderReportDocument } from "../../src/lib/report-document";

test("data-only documents stay isolated and paginate without clipping", async ({ page, browserName }) => {
  await page.setContent(renderReportDocument({
    title: "Receiving Shipment Record",
    metadata: [
      { label: "Invoice number", value: "INV-100" },
      { label: "Supplier", value: '<script>alert("supplier")</script>' },
    ],
    sections: [{
      title: "Received pack line items",
      columns: ["Pack", "Tickets", "Value"],
      rows: Array.from({ length: 150 }, (_, index) => [`Pack ${index + 1}`, 50, "$500.00"]),
    }],
    totals: [{ label: "Received packs", value: 150 }],
  }));
  await expect(page.getByRole("heading", { name: "Receiving Shipment Record" })).toBeVisible();
  await expect(page.getByText('<script>alert("supplier")</script>')).toBeVisible();
  await expect(page.locator("script, nav, button, input, aside")).toHaveCount(0);
  await expect(page.locator("tbody tr")).toHaveCount(150);
  await page.emulateMedia({ media: "print" });
  const layout = await page.locator("main").evaluate((element) => {
    const style = getComputedStyle(element);
    return { position: style.position, overflow: style.overflow, padding: style.padding };
  });
  expect(layout).toEqual({ position: "static", overflow: "visible", padding: "0px" });
  await expect(page.getByText("Pack 150", { exact: true })).toHaveCount(1);
  if (browserName === "chromium") {
    const pdf = await page.pdf({ preferCSSPageSize: true });
    expect((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length).toBeGreaterThan(1);
  }
});
