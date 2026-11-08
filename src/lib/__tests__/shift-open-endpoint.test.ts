import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("manager can open another numbered shift without rewinding a concurrent sale", async (context) => {
  const require = createRequire(import.meta.url);
  const prismaPath = require.resolve("../prisma");
  const sessionPath = require.resolve("../api-session");
  const activityPath = require.resolve("../activity-log");
  const originals = [require.cache[prismaPath], require.cache[sessionPath], require.cache[activityPath]];
  let inTransaction = false;
  let transactionIsolation = "";
  let createdShift: Record<string, unknown> | null = null;
  let beginningLines: Array<Record<string, unknown>> = [];
  let auditLines: Array<Record<string, unknown>> = [];
  let packUpdateCalls = 0;
  const activePack = {
    id: "pack-1", serialNumber: "SERIAL-1", currentTicketNumber: 12,
    firstTicket: 1, ticketQuantity: 150, firstOrLastTicket: "LAST", slot: { slotNumber: "1" },
  };
  const manager = { userId: "manager-1", storeId: "store-1", storeName: "Store", name: "Manager", role: "MANAGER", grantedPermissions: [] };
  const prisma = {
    $executeRawUnsafe: async () => 0,
    $queryRawUnsafe: async () => [{ count: 0 }],
    shift: { findMany: async () => [{ id: "shift-1", shiftNumber: 1 }] },
    pack: {
      findMany: async () => {
        assert.equal(inTransaction, true, "active inventory must be read inside the opening transaction");
        return [{ ...activePack, game: {}, slot: { ...activePack.slot } }];
      },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>, options: { isolationLevel: string }) => {
      inTransaction = true;
      transactionIsolation = options.isolationLevel;
      const tx = {
        $queryRawUnsafe: async () => [{ id: activePack.id }],
        $executeRawUnsafe: async () => 1,
        pack: {
          findMany: async () => {
            assert.equal(inTransaction, true);
            return [{ ...activePack, game: {}, slot: { ...activePack.slot } }];
          },
          update: async () => { packUpdateCalls += 1; },
        },
        shift: { create: async ({ data }: { data: Record<string, unknown> }) => { createdShift = data; return { id: "shift-2" }; } },
        shiftLine: { createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { beginningLines = data; } },
        scanLogEntry: { create: async () => ({}) },
        inventoryAudit: { create: async ({ data }: { data: { lines: { create: Array<Record<string, unknown>> } } }) => { auditLines = data.lines.create; } },
      };
      try {
        return await callback(tx);
      } finally {
        inTransaction = false;
      }
    },
  };
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma } } as NodeJS.Module;
  require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: { getApiSession: async () => manager } } as NodeJS.Module;
  require.cache[activityPath] = { id: activityPath, filename: activityPath, loaded: true, exports: { logInventoryActivity: async () => {} } } as NodeJS.Module;
  context.after(() => {
    for (const [index, path] of [prismaPath, sessionPath, activityPath].entries()) {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    }
  });

  const { POST } = await import("../../app/api/shifts/open/route");
  const request = (shiftNumber: number) => new NextRequest("http://localhost/api/shifts/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shiftNumber, terminalId: "T1", openingCash: 100 }),
  });

  const response = await POST(request(2));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, shiftId: "shift-2", shiftNumber: 2, terminalId: "T1" });
  assert.equal(transactionIsolation, "Serializable");
  assert.deepEqual(createdShift, { storeId: "store-1", shiftNumber: 2, openedById: "manager-1", status: "OPEN" });
  assert.equal(beginningLines[0]?.beginningTicket, 12, "new shift snapshots the current post-sale ticket position");
  assert.equal(auditLines[0]?.expectedTicket, 12, "opening audit uses the LAST direction when converting the current transaction snapshot to its physical ticket ID");
  assert.equal(packUpdateCalls, 0, "opening another shift does not write a stale global pack position");

  const duplicate = await POST(request(1));
  assert.equal(duplicate.status, 409, "an already-open number cannot be claimed twice");
});
