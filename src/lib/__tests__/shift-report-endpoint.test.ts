import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("shift report endpoint authenticates, scopes exact IDs, and ignores dates for historic shifts", async (context) => {
  const require = createRequire(import.meta.url);
  const sessionPath = require.resolve("../api-session");
  const prismaPath = require.resolve("../prisma");
  const originals = [require.cache[sessionPath], require.cache[prismaPath]];
  let session: { storeId: string; storeName: string } | null = null;
  let findCalls = 0;
  let returnShift = false;
  const fakePrisma = {
    shift: {
      findMany: async (query: {
        where: Record<string, unknown>;
        include: { inventoryAudit: { include: Record<string, unknown> } };
      }) => {
        findCalls += 1;
        assert.deepEqual(query.where, { storeId: "authorized-store", status: "CLOSED", id: "historic-shift" });
        assert.ok(query.include.inventoryAudit.include.begunBy);
        assert.ok(query.include.inventoryAudit.include.endedBy);
        if (!returnShift) return [];
        return [{
          id: "historic-shift", openedAt: new Date("2020-01-01T08:00:00Z"), closedAt: new Date("2020-01-01T16:00:00Z"),
          openedBy: { name: "Opener" }, closedBy: { name: "Closer" },
          inventoryAudit: null,
          lines: [{
            packId: "pack", slotNumber: "1", beginningTicket: 50, endingTicket: 38,
            ticketsSold: 12, salesAmount: "60.00",
            pack: { serialNumber: "P1", game: { id: "game", name: "Game", price: "5.00", ticketsPerPack: 50 } },
          }],
        }];
      },
    },
    $queryRawUnsafe: async (_sql: string, storeId: string, ids: string[]) => {
      assert.equal(storeId, "authorized-store");
      assert.deepEqual(ids, ["historic-shift"]);
      return [{ id: "historic-shift", record: { openingCash: "100", expectedCash: "160", countedCash: "155", cashVariance: "-5", terminalId: "T2" } }];
    },
  };
  // Replace the route's server dependencies only within this isolated test process.
  require.cache[sessionPath] = {
    id: sessionPath, filename: sessionPath, loaded: true,
    exports: { getApiSession: async () => session },
  } as NodeJS.Module;
  require.cache[prismaPath] = {
    id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma: fakePrisma },
  } as NodeJS.Module;
  context.after(() => {
    for (const [index, path] of [sessionPath, prismaPath].entries()) {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    }
  });
  const { GET } = await import("../../app/api/reports/shifts/route");
  const request = () => new NextRequest("http://localhost/api/reports/shifts?shiftId=historic-shift&from=invalid&to=invalid");

  const unauthenticated = await GET(request());
  assert.equal(unauthenticated.status, 401);
  assert.equal(findCalls, 0);

  session = { storeId: "authorized-store", storeName: "Authorized Store" };
  const unavailable = await GET(request());
  assert.equal(unavailable.status, 404);
  assert.equal(findCalls, 1);

  returnShift = true;
  const response = await GET(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.shifts.length, 1);
  assert.equal(data.shifts[0].id, "historic-shift");
  assert.equal(data.shifts[0].grossSales, 60);
  assert.equal(data.shifts[0].ticketsSold, 12);
  assert.equal(data.shifts[0].cogs, 57);
  assert.equal(data.shifts[0].cash.cashVariance, -5);
  assert.equal(data.shifts[0].terminalId, "T2");
  assert.equal(data.summary.totalNet, 3);

  const emptyId = await GET(new NextRequest("http://localhost/api/reports/shifts?shiftId="));
  assert.equal(emptyId.status, 400);
  assert.equal(findCalls, 2);
});
