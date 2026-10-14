import assert from "node:assert/strict";
import test from "node:test";
import { canReturnLatestTicket } from "@/lib/ticket-return";

test("all ticket-selling staff can return the matching latest sold ticket", () => {
  for (const role of ["EMPLOYEE", "SHIFT_LEAD", "MANAGER", "OWNER"]) {
    assert.equal(canReturnLatestTicket({ role, requestedBarcode: "ticket", latestBarcode: "ticket" }), true);
  }
});

test("returns reject read-only/unknown roles, missing sales and mismatched barcodes", () => {
  for (const role of ["AUDITOR", "PLATFORM_ADMIN", "unknown"]) {
    assert.equal(canReturnLatestTicket({ role, requestedBarcode: "ticket", latestBarcode: "ticket" }), false);
  }
  for (const latestBarcode of [null, "", "other"]) {
    assert.equal(canReturnLatestTicket({ role: "EMPLOYEE", requestedBarcode: "ticket", latestBarcode }), false);
  }
  assert.equal(canReturnLatestTicket({ role: "EMPLOYEE", requestedBarcode: "", latestBarcode: "" }), false);
});
