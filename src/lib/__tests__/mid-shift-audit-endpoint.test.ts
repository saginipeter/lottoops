import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("mid-shift audit snapshot is store scoped, sorted numerically, and read-only", async (context) => {
  const require = createRequire(import.meta.url);
  const sessionPath = require.resolve("../api-session");
  const prismaPath = require.resolve("../prisma");
  const originals = [require.cache[sessionPath], require.cache[prismaPath]];
  let session: { storeId: string; storeName: string; role?: string; shiftId?: string } | null = null;
  let auditQueries = 0;
  let slotQueries = 0;
  const prisma = {
    inventoryAudit: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        auditQueries += 1;
        assert.deepEqual(where, { id: "audit", storeId: "authorized-store" });
        return {
          id: "audit", status: "OPEN", begunAt: new Date("2026-11-08T08:05:00Z"), endedAt: null,
          begunBy: { name: "Opener" }, endedBy: null,
          shift: { id: "shift", shiftNumber: 2, status: "OPEN", openedAt: new Date("2026-11-08T08:00:00Z"), openedBy: { name: "Manager" } },
          lines: [
            { packId: "pack-10", slotNumber: "10", expectedTicket: 150, beginningPhysicalTicket: 150, endingPhysicalTicket: 0 },
            { packId: "pack-2", slotNumber: "2", expectedTicket: 1, beginningPhysicalTicket: 1, endingPhysicalTicket: null },
          ],
        };
      },
    },
    displaySlot: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        slotQueries += 1;
        assert.deepEqual(where, { storeId: "authorized-store", pack: { status: "ACTIVE" } });
        return [
          { slotNumber: "10", packId: "pack-10", pack: { id: "pack-10", serialNumber: "P10", currentTicketNumber: 0, firstTicket: 1, ticketQuantity: 150, firstOrLastTicket: "LAST", game: { name: "Game 10", ticketsPerPack: 150 } } },
          { slotNumber: "2", packId: "pack-2", pack: { id: "pack-2", serialNumber: "P2", currentTicketNumber: 143, firstTicket: 1, ticketQuantity: 150, firstOrLastTicket: "FIRST", game: { name: "Game 2", ticketsPerPack: 150 } } },
        ];
      },
    },
  };
  require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: { getApiSession: async () => session } } as NodeJS.Module;
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma } } as NodeJS.Module;
  context.after(() => {
    for (const [index, path] of [sessionPath, prismaPath].entries()) {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    }
  });

  const { GET } = await import("../../app/api/inventory-audits/[auditId]/snapshot/route");
  const { GET: getLiveStatus } = await import("../../app/api/inventory-audits/[auditId]/route");
  const request = new NextRequest("http://localhost/api/inventory-audits/audit/snapshot");
  const params = { params: Promise.resolve({ auditId: "audit" }) };
  assert.equal((await GET(request, params)).status, 401);
  assert.equal(auditQueries, 0);

  session = { storeId: "authorized-store", storeName: "Authorized Store", role: "EMPLOYEE", shiftId: "another-shift" };
  const forbidden = await GET(request, params);
  assert.equal(forbidden.status, 403);
  assert.equal(slotQueries, 0, "unauthorized snapshots do not load store inventory");

  session = { storeId: "authorized-store", storeName: "Authorized Store", role: "AUDITOR" };
  const auditorForbidden = await GET(request, params);
  assert.equal(auditorForbidden.status, 403);
  assert.equal(slotQueries, 0, "read-only auditors cannot fetch operational shift snapshots");
  const auditorStatusForbidden = await getLiveStatus(request, params);
  assert.equal(auditorStatusForbidden.status, 403);
  assert.equal(auditQueries, 1, "read-only auditors cannot query live audit status");

  session = { storeId: "authorized-store", storeName: "Authorized Store", role: "EMPLOYEE", shiftId: "shift" };
  const response = await GET(request, params);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  const payload = await response.json();
  assert.deepEqual(payload.activePacks.map((line: { display: string }) => line.display), ["2", "10"]);
  assert.equal(payload.activePacks[0].currentExpectedTicket, 8);
  assert.equal(payload.activePacks[0].provisionalVariance, null);
  assert.equal(payload.activePacks[1].currentExpectedTicket, 0);
  assert.equal(payload.activePacks[1].provisionalVariance, 0);
  assert.equal(payload.shift.status, "OPEN");
  assert.equal(payload.shift.shiftNumber, 2);
  assert.equal(auditQueries, 2, "the requested audit is read for assignment authorization and the fresh snapshot");
  assert.equal(slotQueries, 1);
});
