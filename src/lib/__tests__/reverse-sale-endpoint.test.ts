import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

test("reverse sale only removes the latest pack-wide event and restores the selected shift-local line", async (context) => {
  const require = createRequire(import.meta.url);
  const sessionPath = require.resolve("../api-session");
  const prismaPath = require.resolve("../prisma");
  const originals = [require.cache[sessionPath], require.cache[prismaPath]];
  const priorSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "reverse-sale-test-secret";
  const owner = { userId: "owner", storeId: "store", name: "Owner", role: "OWNER" };
  let latestShiftId = "shift-1";
  let packUpdates = 0;
  let deletedEvents = 0;
  let lineUpdate: Record<string, unknown> | null = null;
  const captures: { packUpdate: { where: Record<string, unknown>; data: Record<string, unknown> } | null } = { packUpdate: null };
  const pinHash = await bcrypt.hash("1234", 4);
  const tx = {
    $queryRawUnsafe: async (query: string) => {
      if (query.includes("SELECT id, \"shift_number\"")) return [{ id: "shift-1", shiftNumber: 1 }];
      if (query.includes("SELECT id, shift_id AS")) return [{ id: "sale-1", shiftId: latestShiftId, ticketBarcode: "12345678901001" }];
      if (query.includes("SELECT COUNT(*)::int")) return [{ ticketsSold: 0 }];
      return [];
    },
    $executeRawUnsafe: async (query: string) => {
      if (query.startsWith("DELETE FROM live_scan_events")) { deletedEvents += 1; return 1; }
      return 0;
    },
    shiftLine: {
      findUnique: async () => ({ id: "line-1", shiftId: "shift-1", packId: "pack-1", beginningTicket: 1, slotNumber: "1" }),
      update: async ({ data }: { data: Record<string, unknown> }) => { lineUpdate = data; return data; },
    },
    pack: {
      findFirst: async () => ({
        id: "pack-1", status: "SOLD_OUT", serialNumber: "12345678901", currentTicketNumber: 0,
        firstTicket: 1, ticketQuantity: 150, firstOrLastTicket: "LAST", ticketPrice: 1,
        game: { price: 1, ticketsPerPack: 150 },
      }),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => { packUpdates += 1; captures.packUpdate = { where, data }; return { count: 1 }; },
    },
    displaySlot: {
      findFirst: async () => ({ id: "display-1", packId: null }),
      update: async () => ({}),
    },
    scanLogEntry: { create: async () => ({}) },
  };
  const prisma = {
    $executeRawUnsafe: async () => 0,
    $queryRawUnsafe: async () => [{ approval_pin_hash: pinHash }],
    shift: { findMany: async () => [{ id: "shift-1" }] },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>, options: { isolationLevel: string }) => {
      assert.equal(options.isolationLevel, "Serializable");
      return callback(tx);
    },
  };
  require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: { getApiSession: async () => owner } } as NodeJS.Module;
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma } } as NodeJS.Module;
  context.after(() => {
    for (const [index, path] of [sessionPath, prismaPath].entries()) {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    }
    if (priorSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = priorSecret;
  });

  const { POST } = await import("../../app/api/packs/reverse-sale/route");
  const request = () => new NextRequest("http://localhost/api/packs/reverse-sale", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packId: "pack-1", pin: "1234", shiftId: "shift-1" }),
  });

  const reversed = await POST(request());
  assert.equal(reversed.status, 200);
  const payload = await reversed.json();
  assert.equal(payload.currentTicketNumber, 1);
  assert.equal(payload.shiftId, "shift-1");
  assert.equal(packUpdates, 1);
  assert.equal(deletedEvents, 1);
  assert.deepEqual(captures.packUpdate?.data, { status: "ACTIVE", currentTicketNumber: 1, completedAt: null });
  assert.deepEqual(lineUpdate, { endingTicket: 1, ticketsSold: 0, salesAmount: 0 });

  latestShiftId = "shift-2";
  const forbidden = await POST(request());
  assert.equal(forbidden.status, 409);
  assert.equal(packUpdates, 1, "an owner cannot rewind shared stock when the latest sale belongs to another shift");
  assert.equal(deletedEvents, 1, "the other shift's event remains intact");
});
