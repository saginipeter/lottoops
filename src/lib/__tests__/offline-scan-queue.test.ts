import assert from "node:assert/strict";
import test from "node:test";
import {
  enqueueOfflineScan,
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
  const first = enqueueOfflineScan(storage, "T1", " 12345 ");
  const second = enqueueOfflineScan(storage, "T1", "12345");

  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(readOfflineScanQueue(storage, "T1")[0]?.serialNumber, "12345");
});

test("offline queue is isolated by terminal and removes synced items", () => {
  const storage = new MemoryStorage();
  const t1 = enqueueOfflineScan(storage, "T1", "111");
  enqueueOfflineScan(storage, "T2", "111");

  assert.equal(readOfflineScanQueue(storage, "T1").length, 1);
  assert.equal(readOfflineScanQueue(storage, "T2").length, 1);
  removeOfflineScan(storage, "T1", t1[0].id);
  assert.equal(readOfflineScanQueue(storage, "T1").length, 0);
  assert.equal(readOfflineScanQueue(storage, "T2").length, 1);
});
