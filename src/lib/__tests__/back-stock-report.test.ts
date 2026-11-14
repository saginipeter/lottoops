import assert from "node:assert/strict";
import test from "node:test";
import { buildBackStockSummaryDocument } from "../back-stock-report";

test("Back Stock summary prints physical pack quantity and 100%/95% values", () => {
  const document = buildBackStockSummaryDocument({
    generatedAt: "2026-11-14T10:15:30.000Z",
    totalPackQuantity: 60,
    totalRetailValue: 50000,
    costPayout95: 47500,
  });
  assert.deepEqual(document.sections[0].columns, [
    "Total Pack Quantity", "Total Retail Value (100%)", "Cost Payout (95%)",
  ]);
  assert.deepEqual(document.sections[0].rows, [[60, "$50,000.00", "$47,500.00"]]);
  assert.match(document.notes?.[0] ?? "", /pack count, not a ticket count/i);
  assert.match(String(document.metadata?.[0].value), /\b\d{1,2}:\d{2}\s(?:AM|PM)\b/);
  assert.doesNotMatch(String(document.metadata?.[0].value), /T.*Z|seconds?/i);
});

test("Back Stock cost payout is rounded from the total face value", () => {
  const document = buildBackStockSummaryDocument({
    generatedAt: "2026-11-14T10:15:30.000Z",
    totalPackQuantity: 1,
    totalRetailValue: 0.1,
    costPayout95: 0.1,
  });
  assert.equal(document.sections[0].rows[0][2], "$0.10");
});
