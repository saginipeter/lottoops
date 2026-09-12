import assert from "node:assert/strict";
import test from "node:test";
import { signTvKioskToken, verifyTvKioskToken } from "@/lib/tv-kiosk";

process.env.JWT_SECRET = "phase3-test-secret-that-is-long-enough";

test("verifies a kiosk token and preserves its store scope", async () => {
  const token = await signTvKioskToken({ storeId: "store-a", storeName: "Store A" }, 60);
  assert.deepEqual(await verifyTvKioskToken(token), {
    type: "TV_KIOSK",
    storeId: "store-a",
    storeName: "Store A",
  });
});

test("rejects a tampered kiosk token", async () => {
  const token = await signTvKioskToken({ storeId: "store-a", storeName: "Store A" }, 60);
  const tampered = `${token}x`;
  assert.equal(await verifyTvKioskToken(tampered), null);
});

test("rejects an expired kiosk token", async () => {
  const token = await signTvKioskToken({ storeId: "store-a", storeName: "Store A" }, 1);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  assert.equal(await verifyTvKioskToken(token), null);
});

test("issues distinct tokens for different stores", async () => {
  const first = await signTvKioskToken({ storeId: "store-a", storeName: "Store A" }, 60);
  const second = await signTvKioskToken({ storeId: "store-b", storeName: "Store B" }, 60);
  assert.equal((await verifyTvKioskToken(first))?.storeId, "store-a");
  assert.equal((await verifyTvKioskToken(second))?.storeId, "store-b");
});
