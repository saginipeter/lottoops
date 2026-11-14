import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("shift report endpoint authenticates, scopes exact IDs, and ignores dates for historic shifts", async (context) => {
  const require = createRequire(import.meta.url);
  const sessionPath = require.resolve("../api-session");
  const prismaPath = require.resolve("../prisma");
  const originals = [require.cache[sessionPath], require.cache[prismaPath]];
  let session: { storeId: string; storeName: string; userId: string; name: string; role: string; shiftId?: string; shiftNumber?: number; terminalId?: string; loginSessionId?: string } | null = null;
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
          id: "historic-shift", shiftNumber: 2, terminalId: "T2", openedAt: new Date("2020-01-01T08:00:00Z"), closedAt: new Date("2020-01-01T16:00:00Z"),
          openedBy: { name: "Opener" }, closedBy: { name: "Closer" },
          inventoryAudit: null,
          lines: [{
            packId: "pack", slotNumber: "1", beginningTicket: 50, endingTicket: 38,
            ticketsSold: 12, salesAmount: "60.00",
            pack: { serialNumber: "P1", firstTicket: 1, ticketQuantity: 50, firstOrLastTicket: "FIRST", game: { id: "game", name: "Game", gameNumber: "1234", price: "5.00", ticketsPerPack: 50 } },
          }],
        }];
      },
    },
    $queryRawUnsafe: async (sql: string, ...values: unknown[]) => {
      if (sql.includes("FROM live_scan_events")) {
        assert.equal(values[0], "authorized-store");
        assert.deepEqual(values[1], ["historic-shift"]);
        if (session?.role === "EMPLOYEE") {
          assert.match(sql, /e\.login_session_id = \$3 AND e\.scanned_by_id = \$4/);
          assert.deepEqual(values.slice(2), ["login-cashier", "cashier"]);
          return [{ shiftId: "historic-shift", sessionId: "login-cashier", employeeId: "cashier", employeeName: "Cashier", terminalId: "T2", signedInAt: new Date("2020-01-01T08:30:00Z"), endedAt: null, packId: "pack", pack: "P1", game: "Game", display: "1", tickets: 2, sales: "10.00", firstSaleAt: new Date("2020-01-01T09:00:00Z"), lastSaleAt: new Date("2020-01-01T09:01:00Z"), hasEstimatedPrice: false }];
        }
        assert.doesNotMatch(sql, /e\.login_session_id = \$3/);
        return [
          { shiftId: "historic-shift", sessionId: "login-cashier", employeeId: "cashier", employeeName: "Cashier", terminalId: "T2", signedInAt: new Date("2020-01-01T08:30:00Z"), endedAt: null, packId: "pack", pack: "P1", game: "Game", display: "1", tickets: 2, sales: "10.00", firstSaleAt: new Date("2020-01-01T09:00:00Z"), lastSaleAt: new Date("2020-01-01T09:01:00Z"), hasEstimatedPrice: false },
          { shiftId: "historic-shift", sessionId: "login-other", employeeId: "other", employeeName: "Other Cashier", terminalId: "T1", signedInAt: new Date("2020-01-01T07:30:00Z"), endedAt: null, packId: "pack-2", pack: "P2", game: "Game", display: "10", tickets: 4, sales: "20.00", firstSaleAt: new Date("2020-01-01T08:00:00Z"), lastSaleAt: new Date("2020-01-01T08:10:00Z"), hasEstimatedPrice: true },
        ];
      }
      assert.equal(values[0], "authorized-store");
      assert.deepEqual(values[1], ["historic-shift"]);
      return [{ id: "historic-shift", record: { registerScratchOffSales: "155", registerSalesRecordedAt: "2020-01-01T16:00:00.000Z", registerSalesRecordedBy: "Manager" } }];
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

  session = { storeId: "authorized-store", storeName: "Authorized Store", userId: "manager", name: "Manager", role: "MANAGER" };
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
  assert.equal(data.shifts[0].registerScratchOffSales, 155);
  assert.equal(data.shifts[0].registerSalesRecordedBy, "Manager");
  assert.equal("cash" in data.shifts[0], false, "reports do not expose historical drawer-cash values");
  assert.equal("openingCash" in data.shifts[0], false);
  assert.equal(data.shifts[0].terminalId, "T2");
  assert.equal(data.shifts[0].operatorSessions.length, 2, "management can review every sign-in grouped by its terminal");
  assert.deepEqual(data.shifts[0].operatorSessions.map((item: { employeeName: string; terminalId: string }) => [item.employeeName, item.terminalId]), [["Other Cashier", "T1"], ["Cashier", "T2"]]);
  assert.equal(data.summary.totalNet, 3);

  session = { storeId: "authorized-store", storeName: "Authorized Store", userId: "cashier", name: "Cashier", role: "EMPLOYEE", shiftId: "historic-shift", shiftNumber: 2, terminalId: "T2", loginSessionId: "login-cashier" };
  const staffResponse = await GET(request());
  assert.equal(staffResponse.status, 200);
  const staffData = await staffResponse.json();
  assert.equal(staffData.shifts[0].grossSales, 10);
  assert.equal(staffData.shifts[0].cogs, 9.5, "staff COGS must be calculated only from the current login's sales");
  assert.equal(staffData.shifts[0].netMargin, 0.5, "staff net must not include revenue from another login in the same shift");
  assert.equal(staffData.shifts[0].ticketsSold, 2);
  assert.equal(staffData.shifts[0].operatorSessionsOnly, true);
  assert.equal(staffData.shifts[0].operatorSessions.length, 1);
  assert.equal(staffData.shifts[0].operatorSessions[0].sessionId, "login-cashier");
  assert.deepEqual(staffData.shifts[0].packSales, []);
  assert.deepEqual(staffData.shifts[0].audit, []);
  assert.equal(staffData.shifts[0].registerScratchOffSales, null, "employee session reports do not return shared register totals");
  assert.equal("cash" in staffData.shifts[0], false);

  session = { storeId: "authorized-store", storeName: "Authorized Store", userId: "manager", name: "Manager", role: "MANAGER" };
  const emptyId = await GET(new NextRequest("http://localhost/api/reports/shifts?shiftId="));
  assert.equal(emptyId.status, 400);
  assert.equal(findCalls, 3);
});
