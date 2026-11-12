import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("active pack metadata updates are scoped, allowlisted, and atomically audited", async (context) => {
  const require = createRequire(import.meta.url);
  const sessionPath = require.resolve("../api-session");
  const prismaPath = require.resolve("../prisma");
  const originals = [require.cache[sessionPath], require.cache[prismaPath]];
  let session: { userId: string; storeId: string; name: string; role: string } | null = { userId: "manager", storeId: "store", name: "Manager", role: "MANAGER" };
  let status = "ACTIVE";
  let store = "store";
  const pack = { id: "pack", storeId: "store", status: "ACTIVE", packNumber: "00017", serialNumber: "12345678901", notes: "Old note", lotNumber: "LOT-A", activationNumber: null as string | null, activationReceipt: null as string | null, activationReceiptPhoto: null as string | null, packImage: null as string | null, game: { name: "Lucky Game", gameNumber: "0042" }, slot: { slotNumber: "08" } };
  const correctionWrites: unknown[][] = [];
  const activityWrites: unknown[][] = [];
  const notificationWrites: unknown[][] = [];
  let transactionCount = 0;
  const tx = {
    $queryRawUnsafe: async (_sql: string, id: string, storeId: string) => id === pack.id && storeId === store ? [{ id }] : [],
    pack: {
      findFirst: async () => ({ ...pack, status, game: pack.game, slot: pack.slot }),
      update: async ({ data }: { data: Record<string, string | null> }) => { Object.assign(pack, data); return { id: pack.id, packNumber: pack.packNumber, serialNumber: pack.serialNumber }; },
    },
    $executeRawUnsafe: async (sql: string, ...values: unknown[]) => {
      if (sql.includes("inventory_correction_logs")) correctionWrites.push(values);
      else if (sql.includes("inventory_activity_logs")) activityWrites.push(values);
      else if (sql.includes("inventory_notifications")) notificationWrites.push(values);
      return 1;
    },
  };
  const fakePrisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>, options?: { isolationLevel: string }) => {
      transactionCount++;
      assert.equal(options?.isolationLevel, "Serializable");
      return callback(tx);
    },
  };
  require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: { getApiSession: async () => session } } as NodeJS.Module;
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma: fakePrisma } } as NodeJS.Module;
  context.after(() => {
    for (const [index, path] of [sessionPath, prismaPath].entries()) {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    }
  });
  const { POST } = await import("../../app/api/packs/[id]/update/route");
  const request = (body: Record<string, unknown>) => new NextRequest("http://localhost/api/packs/pack/update", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const params = { params: Promise.resolve({ id: "pack" }) };

  session = { ...session!, role: "EMPLOYEE" };
  assert.equal((await POST(request({ notes: "New note", reason: "Verified receipt" }), params)).status, 403);
  assert.equal(transactionCount, 0);

  session = { ...session!, role: "MANAGER" };
  for (const blocked of [
    { ticketPrice: 20, reason: "Verified receipt" },
    { currentTicketNumber: 4, reason: "Verified receipt" },
    { firstOrLastTicket: "LAST", reason: "Verified receipt" },
  ]) assert.equal((await POST(request(blocked), params)).status, 400);
  assert.equal(transactionCount, 0, "invalid field names are rejected before database writes");

  const response = await POST(request({ notes: "New note", lotNumber: "LOT-B", reason: "Verified supplier receipt" }), params);
  assert.equal(response.status, 200);
  assert.equal(pack.notes, "New note");
  assert.equal(pack.lotNumber, "LOT-B");
  assert.equal(correctionWrites.length, 2, "one immutable correction row is written per changed field");
  assert.equal(activityWrites.length, 1);
  assert.match(String(activityWrites[0][2]), /Pack 00017.*Game 0042.*notes, lotNumber/);
  assert.equal(notificationWrites.length, 1);
  assert.match(String(notificationWrites[0][5]), /Pack 00017.*Game 0042.*Display 08/);

  status = "BACK_STOCK";
  assert.equal((await POST(request({ notes: "Other note", reason: "Verified supplier receipt" }), params)).status, 409);
  status = "ACTIVE";
  store = "foreign-store";
  assert.equal((await POST(request({ notes: "Foreign attempt", reason: "Verified supplier receipt" }), params)).status, 404);
});
