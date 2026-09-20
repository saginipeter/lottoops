import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTicketProgress,
  getDisplayedTicketNumber,
  getNextDisplayedTicket,
} from "@/lib/tv-display";

test("calculates sold tickets from a descending remaining counter", () => {
  assert.deepEqual(calculateTicketProgress(1, 97, 100), { sold: 3, remaining: 97 });
});

test("does not produce negative sold or remaining values", () => {
  assert.deepEqual(calculateTicketProgress(1, 0, 1), { sold: 1, remaining: 0 });
  assert.deepEqual(calculateTicketProgress(1, 2, 1), { sold: 0, remaining: 1 });
});

test("keeps sell-from-last packs synchronized at one remaining ticket", () => {
  assert.deepEqual(calculateTicketProgress(50, 1, 50), { sold: 49, remaining: 1 });
  assert.equal(getDisplayedTicketNumber(1, 50, 50, "LAST"), 50);
  assert.equal(getNextDisplayedTicket(1, 50, 50, "LAST"), 49);
  assert.equal(getDisplayedTicketNumber(1, 1, 50, "LAST"), 1);
  assert.equal(getNextDisplayedTicket(1, 1, 50, "LAST"), 0);
});

test("derives the next physical ticket from a normal pack", () => {
  assert.equal(getDisplayedTicketNumber(1, 50, 50), 1);
  assert.equal(getNextDisplayedTicket(1, 50, 50), 2);
  assert.equal(getDisplayedTicketNumber(1, 49, 50), 2);
});
