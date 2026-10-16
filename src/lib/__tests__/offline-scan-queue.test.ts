import assert from "node:assert/strict";
import test from "node:test";
import {
  enqueueOfflineScan,
  offlineScanQueueKey,
  readOfflineScanQueue,
  removeOfflineScan,
} from "../offline-scan-queue";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test("offline queue deduplicates the same barcode per terminal", () => {
  const storage = new MemoryStorage();
  const first = enqueueOfflineScan(storage, "store-a", "T1", " 12345 ");
  const second = enqueueOfflineScan(storage, "store-a", "T1", "12345");

  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(readOfflineScanQueue(storage, "store-a", "T1")[0]?.serialNumber, "12345");
});

test("offline queue is isolated by terminal and removes synced items", () => {
  const storage = new MemoryStorage();
  const t1 = enqueueOfflineScan(storage, "store-a", "T1", "111");
  enqueueOfflineScan(storage, "store-a", "T2", "111");

  assert.equal(readOfflineScanQueue(storage, "store-a", "T1").length, 1);
  assert.equal(readOfflineScanQueue(storage, "store-a", "T2").length, 1);
  removeOfflineScan(storage, "store-a", "T1", t1[0].id);
  assert.equal(readOfflineScanQueue(storage, "store-a", "T1").length, 0);
  assert.equal(readOfflineScanQueue(storage, "store-a", "T2").length, 1);
});

test("offline scans stay in their store even when terminal names match", () => {
  const storage = new MemoryStorage();
  const a = enqueueOfflineScan(storage, "store-a", "T1", "111");
  assert.deepEqual(readOfflineScanQueue(storage, "store-b", "T1"), []);
  enqueueOfflineScan(storage, "store-b", "T1", "111");
  removeOfflineScan(storage, "store-b", "T1", a[0].id);
  assert.equal(readOfflineScanQueue(storage, "store-a", "T1").length, 1);
  assert.equal(readOfflineScanQueue(storage, "store-b", "T1").length, 1);
  removeOfflineScan(storage, "store-a", "T1", a[0].id);
  assert.equal(readOfflineScanQueue(storage, "store-a", "T1").length, 0);
  assert.equal(readOfflineScanQueue(storage, "store-b", "T1").length, 1);
});

test("legacy queues without store identity are not replayed or migrated", () => {
  const storage = new MemoryStorage();
  storage.setItem("lottoops:offline-scan-queue:T1", JSON.stringify([{
    id: "legacy", serialNumber: "111", terminalId: "T1", createdAt: new Date().toISOString(),
  }]));
  assert.deepEqual(readOfflineScanQueue(storage, "store-a", "T1"), []);
  assert.deepEqual(readOfflineScanQueue(storage, "store-b", "T1"), []);
  assert.notEqual(offlineScanQueueKey("a:b", "c"), offlineScanQueueKey("a", "b:c"));
});
