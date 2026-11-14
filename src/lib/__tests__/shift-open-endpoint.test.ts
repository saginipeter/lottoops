import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "../session";

test("manager can open another numbered shift without rewinding a concurrent sale", async (context) => {
  const require = createRequire(import.meta.url);
  const prismaPath = require.resolve("../prisma");
  const sessionPath = require.resolve("../api-session");
  const activityPath = require.resolve("../activity-log");
  const originals = [require.cache[prismaPath], require.cache[sessionPath], require.cache[activityPath]];
  let inTransaction = false;
  let transactionIsolation = "";
  const createdShiftCapture: { value: Record<string, unknown> | null } = { value: null };
  let beginningLines: Array<Record<string, unknown>> = [];
  let auditLines: Array<Record<string, unknown>> = [];
  let packUpdateCalls = 0;
  const activePack = {
    id: "pack-1", serialNumber: "SERIAL-1", currentTicketNumber: 12,
    firstTicket: 1, ticketQuantity: 150, firstOrLastTicket: "LAST", slot: { slotNumber: "1" },
  };
  let session: { userId: string; storeId: string; storeName: string; name: string; role: string; grantedPermissions: string[]; loginSessionId?: string } = {
    userId: "manager-1", storeId: "store-1", storeName: "Store", name: "Manager", role: "MANAGER", grantedPermissions: [],
  };
  const priorSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "shift-open-test-only-secret";
  const prisma = {
    $executeRawUnsafe: async () => 0,
    $queryRawUnsafe: async () => [{ count: 0 }],
    shift: { findMany: async ({ where }: { where: { terminalId?: string } }) => where.terminalId === "T1" ? [{ id: "shift-1", shiftNumber: 1 }] : [] },
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
        shift: { create: async ({ data }: { data: Record<string, unknown> }) => { createdShiftCapture.value = data; return { id: "shift-2" }; } },
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
  require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: { getApiSession: async () => session } } as NodeJS.Module;
  require.cache[activityPath] = { id: activityPath, filename: activityPath, loaded: true, exports: { logInventoryActivity: async () => {} } } as NodeJS.Module;
  context.after(() => {
    for (const [index, path] of [prismaPath, sessionPath, activityPath].entries()) {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    }
    if (priorSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = priorSecret;
  });

  const { POST } = await import("../../app/api/shifts/open/route");
  const request = (shiftNumber: number, terminalId = "T1") => new NextRequest("http://localhost/api/shifts/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shiftNumber, terminalId, openingCash: 100 }),
  });

  const response = await POST(request(2));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, shiftId: "shift-2", shiftNumber: 2, terminalId: "T1" });
  assert.equal(transactionIsolation, "Serializable");
  assert.deepEqual(createdShiftCapture.value, { storeId: "store-1", shiftNumber: 2, terminalId: "T1", openedById: "manager-1", status: "OPEN" });
  assert.equal(beginningLines[0]?.beginningTicket, 12, "new shift snapshots the current post-sale ticket position");
  assert.equal(auditLines[0]?.expectedTicket, 12, "opening audit uses the LAST direction when converting the current transaction snapshot to its physical ticket ID");
  assert.equal(packUpdateCalls, 0, "opening another shift does not write a stale global pack position");

  const duplicate = await POST(request(1));
  assert.equal(duplicate.status, 409, "an already-open number cannot be claimed twice");

  const otherTerminal = await POST(request(1, "T2"));
  assert.equal(otherTerminal.status, 200, "the same numbered shift may be open at another terminal");
  assert.equal((await otherTerminal.json()).terminalId, "T2");
  assert.equal(createdShiftCapture.value?.terminalId, "T2");

  session = { userId: "employee-1", storeId: "store-1", storeName: "Store", name: "Employee", role: "EMPLOYEE", grantedPermissions: [], loginSessionId: "employee-login" };
  const employeeOpen = await POST(request(2, "T2"));
  assert.equal(employeeOpen.status, 200, "employees may open a numbered shift on any authorized terminal in their store");
  const employeeOpenPayload = await employeeOpen.json();
  assert.equal(employeeOpenPayload.shiftNumber, 2);
  assert.equal(employeeOpenPayload.terminalId, "T2");
  assert.equal(createdShiftCapture.value?.openedById, "employee-1");
  assert.equal(createdShiftCapture.value?.terminalId, "T2");
  assert.equal("openingCash" in (createdShiftCapture.value ?? {}), false, "new shifts do not write opening drawer cash");
  const employeeToken = employeeOpen.cookies.get(SESSION_COOKIE)?.value;
  assert.ok(employeeToken);
  const employeeSession = await verifySession(employeeToken);
  assert.equal(employeeSession?.shiftId, "shift-2");
  assert.equal(employeeSession?.shiftNumber, 2);
  assert.equal(employeeSession?.terminalId, "T2");
  assert.equal(employeeSession?.loginSessionId, "employee-login");

  const shiftThree = await POST(request(3, "T2"));
  assert.equal(shiftThree.status, 400, "Shift 3 is no longer an option for newly opened shifts");
});
