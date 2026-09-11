import assert from "node:assert/strict";
import test from "node:test";
import { calculateTicketProgress } from "@/lib/tv-display";

test("calculates sold tickets from a descending ticket sequence", () => {
  assert.deepEqual(calculateTicketProgress(100, 97, 100), { sold: 3, remaining: 97 });
});

test("does not produce negative sold or remaining values", () => {
  assert.deepEqual(calculateTicketProgress(1, 0, 1), { sold: 1, remaining: 0 });
  assert.deepEqual(calculateTicketProgress(1, 2, 1), { sold: 0, remaining: 1 });
});