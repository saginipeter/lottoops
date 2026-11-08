import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("shift-line reconciliation is shift-local and employee-bound", async (context) => {
  const require = createRequire(import.meta.url);
  const sessionPath = require.resolve("../api-session");
  const prismaPath = require.resolve("../prisma");
  const originals = [require.cache[sessionPath], require.cache[prismaPath]];
  let session: { userId: string; storeId: string; role: string; shiftId?: string } = { userId: "employee", storeId: "store", role: "EMPLOYEE", shiftId: "shift-1" };
  let lineShiftId = "shift-1";
  let update: Record<string, unknown> | null = null;
  let eventCountReads = 0;
  const records = [{
    id: "line-1", shiftId: lineShiftId, beginningTicket: 10,
    shift: { id: lineShiftId, storeId: "store", status: "OPEN" },
    pack: { id: "pack-1", ticketPrice: 2, game: { price: 2 } },
  }];
  const tx = {
    shiftLine: {
      findMany: async () => records,
      update: async ({ data }: { data: Record<string, unknown> }) => { update = data; return data; },
    },
    $queryRawUnsafe: async (query: string) => {
      if (query.includes("pack_id AS \"packId\"")) { eventCountReads += 1; return [{ packId: "pack-1", ticketsSold: 3 }]; }
      return [{ id: lineShiftId }];
    },
    shift: { findFirst: async () => ({ id: lineShiftId, status: "OPEN" }) },
  };
  const prisma = { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: { getApiSession: async () => session } } as NodeJS.Module;
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma } } as NodeJS.Module;
  context.after(() => {
    for (const [index, path] of [sessionPath, prismaPath].entries()) {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    }
  });

  const { POST } = await import("../../app/api/shifts/update-lines/route");
  const request = () => new NextRequest("http://localhost/api/shifts/update-lines", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: [{ id: "line-1" }] }),
  });
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(update, { endingTicket: 7, ticketsSold: 3, salesAmount: 6 });
  assert.equal(eventCountReads, 1);

  lineShiftId = "shift-2";
  records[0].shiftId = lineShiftId;
  records[0].shift = { id: lineShiftId, storeId: "store", status: "OPEN" };
  update = null;
  const forbidden = await POST(request());
  assert.equal(forbidden.status, 403);
  assert.equal(update, null, "the signed-in employee cannot reconcile another numbered shift");

  session = { userId: "auditor", storeId: "store", role: "AUDITOR" };
  assert.equal((await POST(request())).status, 403);
});
