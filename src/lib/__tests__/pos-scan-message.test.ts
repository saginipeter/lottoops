import assert from "node:assert/strict";
import { test } from "node:test";
import { formatTicketScanBlockedMessage } from "../pos-scan-message";

test("sequence lock notice preserves expected/scanned ticket numbers and confirms no sale", () => {
  const message = formatTicketScanBlockedMessage({
    code: "SEQUENCE_LOCKED",
    error: "Out-of-sequence scan. Expected ticket 50, but scanned ticket 1. Pack locked pending manager review.",
    status: 409,
  });
  assert.match(message, /no ticket was sold/i);
  assert.match(message, /expects ticket 50, but ticket 1 was scanned/i);
  assert.match(message, /please ask a manager/i);
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
