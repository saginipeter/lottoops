import assert from "node:assert/strict";
import { test } from "node:test";
import { formatTicketScanBlockedMessage } from "../pos-scan-message";

test("sequence mismatch gives the exact non-locking no-sale cashier warning without manager-review language", () => {
  const message = formatTicketScanBlockedMessage({
    code: "TICKET_SEQUENCE_MISMATCH",
    error: "Wrong ticket scanned in this shift, no sales recorded. The system expected ticket 50; ticket 1 was scanned.",
    status: 409,
    expectedTicket: 50,
    scannedTicketNumber: 1,
  });
  assert.equal(message, "Wrong ticket scanned in this shift, no sales recorded. Expected ticket 50; ticket 1 was scanned.");
  assert.doesNotMatch(message, /manager|review|locked/i);
});

test("ticket number 000 is described as an invalid no-sale barcode", () => {
  assert.match(formatTicketScanBlockedMessage({ code: "INVALID_TICKET_NUMBER" }), /invalid ticket number.*no sale was recorded/i);
});

test("opening audit rejection explains the next step kindly", () => {
  const message = formatTicketScanBlockedMessage({ code: "BEGINNING_AUDIT_REQUIRED" });
  assert.match(message, /scan is blocked/i);
  assert.match(message, /opening audit/i);
  assert.match(message, /no ticket was sold/i);
});

test("invalid display-pack scans advise the cashier to check the barcode", () => {
  const message = formatTicketScanBlockedMessage({ error: "Ticket scan rejected: no active display pack matches this barcode.", status: 404 });
  assert.match(message, /not sold/i);
  assert.match(message, /check the barcode/i);
  assert.match(message, /ask a manager/i);
});

test("server verification failures do not expose a raw technical error", () => {
  const message = formatTicketScanBlockedMessage({ error: "Failed to check serial number", status: 500 });
  assert.match(message, /couldn’t confirm the result/i);
  assert.match(message, /check the latest scan and pack status/i);
  assert.doesNotMatch(message, /no ticket was sold|not sold/i);
  assert.doesNotMatch(message, /Failed to check serial number/);
});
