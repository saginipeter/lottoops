import assert from "node:assert/strict";
import test from "node:test";
import { nextPendingPosQueueEntry, parsePosOfflineQueue, type PosQueueEntry } from "../pos-offline-queue";

const entry = (id: string, values: Partial<PosQueueEntry> = {}): PosQueueEntry => ({
  id,
  barcode: "12345678901234",
  queuedAt: "2026-11-08T12:00:00.000Z",
  attempts: 0,
  state: "PENDING",
  ...values,
});

test("queue parser preserves valid legacy entries and rejects malformed data without returning an empty queue", () => {
  assert.deepEqual(parsePosOfflineQueue(null), []);
  assert.deepEqual(parsePosOfflineQueue(JSON.stringify([{ id: "old", barcode: "12345678901234", queuedAt: "2026-11-08T12:00:00.000Z", attempts: 1 }])), [
    { id: "old", barcode: "12345678901234", queuedAt: "2026-11-08T12:00:00.000Z", attempts: 1 },
  ]);
  for (const malformed of ["not-json", "null", "{}", JSON.stringify([null]), JSON.stringify([{ ...entry("bad"), barcode: "short" }])]) {
    assert.throws(() => parsePosOfflineQueue(malformed), /Saved scan queue data/);
  }
});

test("FIFO skips a rejected volatile conflict but keeps later valid scans eligible", () => {
  const first = entry("rejected", { state: "CONFLICT" });
  const second = entry("failed-local-write", { state: "PENDING" });
  const third = entry("later", { state: "PENDING" });
  assert.equal(nextPendingPosQueueEntry([first, second, third])?.id, "failed-local-write");
  assert.equal(nextPendingPosQueueEntry([second, third], new Set(["failed-local-write"]))?.id, "later");
  assert.equal(nextPendingPosQueueEntry([first, second], new Set(["failed-local-write"])), undefined);
});
