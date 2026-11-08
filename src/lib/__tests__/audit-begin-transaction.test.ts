import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("beginning audit snapshots LAST-direction inventory inside the numbered shift transaction", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../prisma", "../shift-participants"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  const session = { userId: "manager", storeId: "store", name: "Manager", role: "MANAGER" };
  const lockOrder: string[] = [];
  const captures: { auditLine: Record<string, unknown> | null; shiftLine: Record<string, unknown> | null } = { auditLine: null, shiftLine: null };
  const tx = {
    $queryRawUnsafe: async (query: string) => {
      if (query.includes("FROM shifts")) { lockOrder.push("shift"); return [{ id: "shift" }]; }
      if (query.includes("FROM packs")) { lockOrder.push("packs"); return [{ id: "pack" }]; }
      return [];
    },
    inventoryAudit: {
      findUnique: async () => null,
      create: async ({ data }: { data: { lines: { create: Array<Record<string, unknown>> } } }) => { captures.auditLine = data.lines.create[0]; return { id: "audit", ...data }; },
    },
    displaySlot: { findMany: async () => [{
      slotNumber: "10", packId: "pack",
      pack: { id: "pack", currentTicketNumber: 12, firstTicket: 1, ticketQuantity: 150, firstOrLastTicket: "LAST", game: { ticketsPerPack: 150 } },
    }] },
    shiftLine: { createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { captures.shiftLine = data[0]; return { count: 1 }; } },
  };
  const prisma = {
    shift: { findFirst: async () => ({ id: "shift" }) },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>, options: { isolationLevel: string }) => {
      assert.equal(options.isolationLevel, "Serializable");
      return callback(tx);
    },
  };
  const exports = [
    { getApiSession: async () => session },
    { prisma },
    { recordShiftParticipant: async () => {} },
  ];
  paths.forEach((path, index) => { require.cache[path] = { id: path, filename: path, loaded: true, exports: exports[index] } as NodeJS.Module; });
  context.after(() => paths.forEach((path, index) => {
    if (originals[index]) require.cache[path] = originals[index];
    else delete require.cache[path];
  }));

  const { POST } = await import("../../app/api/inventory-audits/begin/route");
  const response = await POST(new NextRequest("http://localhost/api/inventory-audits/begin", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shiftId: "shift" }),
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(lockOrder, ["shift", "packs"]);
  assert.equal(captures.auditLine?.expectedTicket, 12);
  assert.equal(captures.shiftLine?.beginningTicket, 12);
});
