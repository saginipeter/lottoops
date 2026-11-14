import assert from "node:assert/strict";
import { test } from "node:test";
import { formatTicketScanBlockedMessage } from "../pos-scan-message";

test("sequence mismatch gives a clear non-locking no-track cashier warning without manager-review language", () => {
  const message = formatTicketScanBlockedMessage({
    code: "TICKET_SEQUENCE_MISMATCH",
    error: "Wrong ticket scanned in this shift. No ticket was tracked. The system expected ticket 50; ticket 1 was scanned.",
    status: 409,
    expectedTicket: 50,
    scannedTicketNumber: 1,
  });
  assert.equal(message, "Wrong ticket scanned in this shift. No ticket was tracked. Expected ticket 50; ticket 1 was scanned.");
  assert.doesNotMatch(message, /manager|review|locked/i);
});

test("ticket number 000 is described as an invalid, untracked barcode", () => {
  assert.match(formatTicketScanBlockedMessage({ code: "INVALID_TICKET_NUMBER" }), /invalid ticket number.*no ticket was tracked/i);
});

test("depleted packs are described as having no tickets remaining", () => {
  assert.match(formatTicketScanBlockedMessage({ error: "Pack has no tickets remaining.", status: 400 }), /no tickets remaining.*no ticket was tracked/i);
});

test("opening audit rejection explains the next step kindly", () => {
  const message = formatTicketScanBlockedMessage({ code: "BEGINNING_AUDIT_REQUIRED" });
  assert.match(message, /opening audit/i);
  assert.match(message, /no ticket was tracked/i);
  assert.doesNotMatch(message, /scan blocked/i);
});

test("invalid display-pack scans advise the cashier to check the barcode", () => {
  const message = formatTicketScanBlockedMessage({ error: "Ticket scan rejected: no active display pack matches this barcode.", status: 404 });
  assert.match(message, /not tracked/i);
  assert.match(message, /check the barcode/i);
  assert.match(message, /ask a manager/i);
});

test("server verification failures do not expose a raw technical error", () => {
  const message = formatTicketScanBlockedMessage({ error: "Failed to check serial number", status: 500 });
  assert.match(message, /couldn’t confirm the result/i);
  assert.match(message, /check the latest scan and pack status/i);
  assert.doesNotMatch(message, /no ticket was tracked|not tracked/i);
  assert.doesNotMatch(message, /Failed to check serial number/);
});
