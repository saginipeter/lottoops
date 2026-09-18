import assert from "node:assert/strict";
import test from "node:test";
import { canAuthorizeCorrection, canSelfResolveSequenceLock } from "@/lib/control-validation";
import { parseBarcode } from "@/lib/barcode";
import { getActivationStartingTicket, getDisplayedCurrentTicket, getSuggestedTicketQuantity } from "@/lib/ticket-quantity";

test("only the exact expected ticket can self-resolve a sequence lock", () => {
  assert.equal(canSelfResolveSequenceLock(true, 42, 42), true);
  assert.equal(canSelfResolveSequenceLock(true, 42, 41), false);
  assert.equal(canSelfResolveSequenceLock(false, 42, 42), false);
  assert.equal(canSelfResolveSequenceLock(true, null, 42), false);
});

test("only managers and owners can authorize corrections", () => {
  assert.equal(canAuthorizeCorrection("OWNER"), true);
  assert.equal(canAuthorizeCorrection("MANAGER"), true);
  assert.equal(canAuthorizeCorrection("SHIFT_LEAD"), false);
  assert.equal(canAuthorizeCorrection("EMPLOYEE"), false);
});

test("$1 tickets suggest a 50-ticket pack quantity", () => {
  assert.equal(getSuggestedTicketQuantity(1), 50);
});

test("selling from the last ticket starts at the pack quantity instead of 1", () => {
  assert.equal(
    getActivationStartingTicket({
      currentTicketNumber: null,
      firstTicket: 1,
      ticketQuantity: 150,
      firstOrLastTicket: "LAST",
    }),
    150
  );

  assert.equal(
    getActivationStartingTicket({
      currentTicketNumber: null,
      firstTicket: 1,
      ticketQuantity: 150,
      firstOrLastTicket: "FIRST",
    }),
    1
  );
});

test("prefers the real current ticket over zero defaults and stale fallbacks", () => {
  assert.equal(
    getDisplayedCurrentTicket({
      currentTicketNumber: 150,
      firstTicket: 1,
      ticketQuantity: 150,
    }),
    150
  );

  assert.equal(
    getDisplayedCurrentTicket({
      currentTicketNumber: 0,
      firstTicket: 1,
      ticketQuantity: 150,
    }),
    1
  );

  assert.equal(
    getDisplayedCurrentTicket({
      currentTicketNumber: 150,
      firstTicket: 1,
      ticketQuantity: 50,
    }),
    1
  );
});

test("parses a ticket label with hyphens and trailer digits from the phone camera", () => {
  const parsed = parseBarcode("2769-0024564-001 (050)");
  assert.deepEqual(parsed, {
    gameNumber: "2769",
    packNumber: "0024564",
    firstTicket: "001",
  });
});