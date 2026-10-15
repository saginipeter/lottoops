import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("audit scans retain signed variances and never increase remaining inventory", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../prisma", "../activity-log", "../shift-participants"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  let session: { userId: string; storeId: string; name: string } | null = { userId: "staff", storeId: "store", name: "Staff" };
  const pack = {
    id: "pack", currentTicketNumber: 141, firstTicket: 1, ticketQuantity: 150,
    firstOrLastTicket: "FIRST", slot: { slotNumber: "1" }, game: { ticketsPerPack: 150 },
  };
  const line = { id: "line", packId: "pack", expectedTicket: 1, beginningPhysicalTicket: 1, endingPhysicalTicket: null };
  let writes = 0;
  const prisma = {
    inventoryAudit: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        assert.equal(where.storeId, "store");
        return { id: "audit", shiftId: "shift", lines: [line] };
      },
    },
    pack: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        assert.equal(where.storeId, "store");
        assert.equal(where.status, "ACTIVE");
        assert.deepEqual(where.slot, { isNot: null });
        return pack;
      },
    },
    inventoryAuditLine: {
      update: async ({ data }: { data: Record<string, unknown> }) => { writes++; return { ...line, ...data }; },
    },
  };
  const exports = [
    { getApiSession: async () => session }, { prisma },
    { logInventoryActivity: async () => {} }, { recordShiftParticipant: async () => {} },
  ];
  paths.forEach((path, index) => {
    require.cache[path] = { id: path, filename: path, loaded: true, exports: exports[index] } as NodeJS.Module;
  });
  context.after(() => paths.forEach((path, index) => {
    if (originals[index]) require.cache[path] = originals[index];
    else delete require.cache[path];
  }));
  const { POST } = await import("../../app/api/inventory-audits/scan/route");
  const scan = (ticket: number, phase = "ending") => POST(new NextRequest("http://localhost/api/inventory-audits/scan", {
    method: "POST", body: JSON.stringify({ auditId: "audit", serialNumber: `12341234567${String(ticket).padStart(3, "0")}`, phase }),
  }));
  for (const [ticket, variance, remaining, sold] of [[11, 1, 140, false], [9, -1, 141, true]] as const) {
    const response = await scan(ticket);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.variance, variance);
    assert.equal(result.remaining, remaining);
    assert.equal(result.scannedSoldTicket, sold);
  }
  const opening = await scan(9, "beginning");
  assert.equal((await opening.json()).variance, -1);
  pack.firstOrLastTicket = "LAST";
  pack.currentTicketNumber = 140;
  const matching = await scan(140);
  assert.equal(matching.status, 200);
  const matchingResult = await matching.json();
  assert.equal(matchingResult.variance, 0);
  assert.equal(matchingResult.remaining, 140);
  assert.equal(matchingResult.scannedSoldTicket, false);
  const descending = await scan(141);
  assert.equal(descending.status, 200);
  assert.equal((await descending.json()).remaining, 140);
  const before = writes;
  assert.equal((await scan(151)).status, 400);
  assert.equal(writes, before);
  session = null;
  assert.equal((await scan(140)).status, 401);
  assert.equal(pack.currentTicketNumber, 140, "audit scans must never mutate the stock ledger");
});
