import assert from "node:assert/strict";
import test from "node:test";
import { canAuthorizeCorrection, canSelfResolveSequenceLock } from "@/lib/control-validation";
import { isValidPackBarcode, parseBarcode } from "@/lib/barcode";
import {
  getActivationStartingTicket,
  getAuditPhysicalTicket,
  getDisplayedCurrentTicket,
  getSafeCurrentTicket,
  getSuggestedTicketQuantity,
  getValidTicketState,
} from "@/lib/ticket-quantity";

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

test("$1 tickets suggest a 150-ticket pack quantity", () => {
  assert.equal(getSuggestedTicketQuantity(1), 150);
});

test("$10 games use 50 tickets per pack across catalog and receiving", () => {
  assert.equal(getSuggestedTicketQuantity(10), 50);
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
    150
  );

  assert.equal(
    getDisplayedCurrentTicket({
      currentTicketNumber: 150,
      firstTicket: 1,
      ticketQuantity: 50,
    }),
    50
  );
});

test("activation never picks a stale ticket above the pack quantity", () => {
  assert.equal(
    getActivationStartingTicket({
      currentTicketNumber: 150,
      firstTicket: 1,
      ticketQuantity: 50,
      firstOrLastTicket: "FIRST",
    }),
    1
  );

  assert.equal(
    getActivationStartingTicket({
      currentTicketNumber: 150,
      firstTicket: 1,
      ticketQuantity: 50,
      firstOrLastTicket: "LAST",
    }),
    50
  );
});

test("stale current tickets are ignored in favor of the real first ticket", () => {
  assert.equal(
    getSafeCurrentTicket({
      currentTicketNumber: 150,
      firstTicket: 1,
      ticketQuantity: 50,
    }),
    50
  );

  assert.equal(
    getDisplayedCurrentTicket({
      currentTicketNumber: 150,
      firstTicket: 1,
      ticketQuantity: 50,
    }),
    50
  );
});

test("converts a non-one physical starting ticket to remaining inventory", () => {
  assert.equal(
    getSafeCurrentTicket({
      currentTicketNumber: 150,
      firstTicket: 25,
      ticketQuantity: 50,
    }),
    26
  );
});

test("normalizes a stale physical first ticket before sequence validation", () => {
  assert.deepEqual(
    getValidTicketState({
      currentTicketNumber: 44,
      firstTicket: 150,
      ticketQuantity: 50,
    }),
    {
      currentTicketNumber: 44,
      firstTicket: 1,
      ticketQuantity: 50,
    }
  );
});

test("converts remaining inventory to the physical ticket used by audits", () => {
  assert.equal(getAuditPhysicalTicket({ currentTicketNumber: 42, firstTicket: 1, ticketQuantity: 50 }), 9);
  assert.equal(getAuditPhysicalTicket({ currentTicketNumber: 44, firstTicket: 150, ticketQuantity: 50 }), 7);
  assert.equal(getAuditPhysicalTicket({ currentTicketNumber: 0, firstTicket: 1, ticketQuantity: 50 }), 0);
});

test("parses a ticket label with hyphens and trailer digits from the phone camera", () => {
  const parsed = parseBarcode("27690024564001");
  assert.deepEqual(parsed, {
    gameNumber: "2769",
    packNumber: "0024564",
    firstTicket: "1",
  });
});

test("parses the compact active-stock barcode 27690025564001", () => {
  assert.deepEqual(parseBarcode("27690025564001"), {
    gameNumber: "2769",
    packNumber: "0025564",
    firstTicket: "1",
  });
});

test("accepts only complete 14-digit pack ticket barcodes", () => {
  assert.equal(isValidPackBarcode("24240089877001"), true);
  assert.equal(isValidPackBarcode("24240089877021"), true);
  assert.equal(isValidPackBarcode("24240089877150"), true);
  assert.equal(isValidPackBarcode("24240089877"), false);
  assert.equal(isValidPackBarcode("24240089877001050"), false);
});
