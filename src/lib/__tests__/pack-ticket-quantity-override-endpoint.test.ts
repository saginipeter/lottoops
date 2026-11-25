import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("pack edit requires a reason for changed quantities and stores server catalog snapshot immutably", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../prisma", "../permissions"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  const session = { userId: "manager-1", storeId: "store-a", name: "Manager", role: "MANAGER" };
  let packRow: {
    id: string; status: string; currentTicketNumber: number | null; ticketQuantity: number | null;
    expectedTicketQuantity: number; serialNumber: string; packNumber: string | null; gameName: string; gameNumber: string;
  } | null = { id: "pack-a", status: "RECEIVING", currentTicketNumber: 1, ticketQuantity: 50, expectedTicketQuantity: 75,
    serialNumber: "barcode-a", packNumber: "0001", gameName: "Lucky", gameNumber: "123" };
  let updateData: Record<string, unknown> | null = null;
  const auditRows: Array<Record<string, unknown>> = [];
  const queryCalls: Array<{ sql: string; values: unknown[] }> = [];
  const tx = {
    $queryRawUnsafe: async (sql: string, ...values: unknown[]) => {
      queryCalls.push({ sql, values });
      return packRow ? [packRow] : [];
    },
    pack: {
      update: async ({ data, include }: { data: Record<string, unknown>; include: Record<string, unknown> }) => {
        updateData = data;
        if (packRow) packRow.ticketQuantity = Number(data.ticketQuantity);
        assert.deepEqual(include, { game: true });
        return { id: "pack-a", ...data, game: { ticketsPerPack: 75 } };
      },
    },
    packTicketQuantityOverride: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        auditRows.push(data);
        return { id: "audit-a", ...data, createdAt: new Date("2026-11-25T10:00:00.000Z") };
      },
    },
  };
  const fakePrisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>, options?: { isolationLevel: string }) => {
      assert.equal(options?.isolationLevel, "Serializable");
      return callback(tx);
    },
  };
  require.cache[paths[0]] = { id: paths[0], filename: paths[0], loaded: true, exports: { getApiSession: async () => session } } as NodeJS.Module;
  require.cache[paths[1]] = { id: paths[1], filename: paths[1], loaded: true, exports: { prisma: fakePrisma } } as NodeJS.Module;
  require.cache[paths[2]] = { id: paths[2], filename: paths[2], loaded: true, exports: { canReceiveShipments: () => true } } as NodeJS.Module;
  context.after(() => paths.forEach((path, index) => {
    if (originals[index]) require.cache[path] = originals[index];
    else delete require.cache[path];
  }));

  const { PATCH } = await import("../../app/api/packs/route");
  const request = (body: unknown) => new NextRequest("http://localhost/api/packs", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const baseBody = { packId: "pack-a", firstTicket: 1, ticketPrice: 2, ticketQuantity: 40 };

  const missingReason = await PATCH(request({ ...baseBody, expectedTicketQuantity: 999 }));
  assert.equal(missingReason.status, 400);
  assert.match((await missingReason.json()).error, /reason is required/i);
  assert.equal(updateData, null, "invalid changes never update the pack");
  assert.equal(auditRows.length, 0);

  const saved = await PATCH(request({ ...baseBody, expectedTicketQuantity: 999, reason: "Supplier-confirmed short pack." }));
  assert.equal(saved.status, 200);
  assert.equal(queryCalls[0].values[0], "pack-a");
  assert.equal(queryCalls[0].values[1], "store-a");
  assert.match(queryCalls[0].sql, /ticketsPerPack[\s\S]*JOIN games g/);
  assert.deepEqual(auditRows[0], {
    storeId: "store-a", packId: "pack-a", serialNumber: "barcode-a", packNumber: "0001",
    gameName: "Lucky", gameNumber: "123", expectedTicketQuantity: 75, recordedTicketQuantity: 40, reason: "Supplier-confirmed short pack.", status: "RECORDED", actorUserId: "manager-1",
  });
  assert.equal((updateData as Record<string, unknown> | null)?.ticketQuantity, 40);
  assert.equal(auditRows[0].expectedTicketQuantity, 75, "forged client expected quantity is ignored");
  assert.equal((await saved.json()).ticketQuantityOverride.expectedTicketQuantity, 75);

  const unchangedQuantity = await PATCH(request({ ...baseBody, ticketQuantity: 40 }));
  assert.equal(unchangedQuantity.status, 200);
  assert.equal(auditRows.length, 1, "editing other pack details without changing the override does not duplicate the audit event");

  const restoredToExpected = await PATCH(request({ ...baseBody, ticketQuantity: 75 }));
  assert.equal(restoredToExpected.status, 200, "restoring the server catalog quantity is not an override");
  assert.equal(auditRows.length, 1);

  packRow = null;
  const otherStore = await PATCH(request({ ...baseBody, reason: "Cross-store access attempt." }));
  assert.equal(otherStore.status, 404);
  assert.equal(auditRows.length, 1, "a pack not owned by the session store cannot be audited or edited");
});
