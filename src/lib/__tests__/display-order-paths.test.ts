import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const shuffledDisplays = ["100", "10", "2", "99", "11", "1"];
const expectedDisplays = ["1", "2", "10", "11", "99", "100"];
const displaySlots = shuffledDisplays.map((slotNumber) => ({
  id: `slot-${slotNumber}`,
  slotNumber,
  packId: `pack-${slotNumber}`,
  pack: {
    id: `pack-${slotNumber}`,
    serialNumber: `SERIAL-${slotNumber}`,
    status: "ACTIVE",
    currentTicketNumber: 8,
    firstTicket: 1,
    ticketQuantity: 10,
    firstOrLastTicket: "FIRST",
    ticketPrice: "5.00",
    cost: "40.00",
    retailValue: "50.00",
    gameId: `game-${slotNumber}`,
    game: { id: `game-${slotNumber}`, name: `Game ${slotNumber}`, gameNumber: slotNumber, price: "5.00", ticketsPerPack: 10 },
  },
}));

const reportLines = shuffledDisplays.map((slotNumber) => ({
  packId: `pack-${slotNumber}`,
  slotNumber,
  beginningTicket: 10,
  endingTicket: 8,
  ticketsSold: 2,
  salesAmount: "10.00",
  pack: {
    serialNumber: `SERIAL-${slotNumber}`,
    firstTicket: 1,
    ticketQuantity: 10,
    firstOrLastTicket: "FIRST",
    game: { id: `game-${slotNumber}`, gameNumber: slotNumber, name: `Game ${slotNumber}`, price: "5.00", ticketsPerPack: 10 },
  },
}));
const reportAuditLines = shuffledDisplays.map((slotNumber) => ({
  packId: `pack-${slotNumber}`,
  slotNumber,
  expectedTicket: 8,
  endingExpectedTicket: 8,
  beginningPhysicalTicket: 10,
  endingPhysicalTicket: 8,
  pack: { serialNumber: `SERIAL-${slotNumber}` },
}));
const shiftRecord = {
  id: "shift",
  shiftNumber: 1,
  terminalId: "T1",
  openedAt: new Date("2026-11-01T08:00:00Z"),
  closedAt: new Date("2026-11-01T16:00:00Z"),
  openedBy: { name: "Manager" },
  closedBy: { name: "Manager" },
  lines: reportLines,
  inventoryAudit: {
    begunBy: { name: "Manager" },
    endedBy: { name: "Manager" },
    begunAt: new Date("2026-11-01T08:05:00Z"),
    endedAt: new Date("2026-11-01T16:00:00Z"),
    lines: reportAuditLines,
  },
};

function assertNumericDisplays(rows: Array<{ display?: string; slotNumber?: string }>, key: "display" | "slotNumber") {
  assert.deepEqual(rows.map((row) => row[key]), expectedDisplays);
}

test("display ordering is numeric at the actual inventory, display-slot, audit, and shift-report paths", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../get-session", "../prisma"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  const fakePrisma = {
    $executeRawUnsafe: async () => 1,
    displaySlot: {
      findMany: async (query?: { select?: Record<string, unknown> }) => query?.select && Object.keys(query.select).length === 1
        ? displaySlots.map((slot) => ({ slotNumber: slot.slotNumber }))
        : displaySlots,
      createMany: async () => ({ count: 0 }),
    },
    pack: { findMany: async () => [] },
    inventoryAudit: {
      findFirst: async () => ({
        id: "audit",
        status: "OPEN",
        shiftId: "shift",
        lines: [],
      }),
    },
    shift: { findMany: async () => [shiftRecord] },
    $queryRawUnsafe: async (query: string) => query.includes("FROM live_scan_events")
      ? shuffledDisplays.map((display) => ({
          shiftId: "shift",
          sessionId: "session",
          employeeId: "employee",
          employeeName: "Operator",
          terminalId: "T1",
          signedInAt: new Date("2026-11-01T08:30:00Z"),
          endedAt: null,
          packId: `pack-${display}`,
          pack: `SERIAL-${display}`,
          game: `Game ${display}`,
          display,
          tickets: 1,
          sales: "5.00",
          firstSaleAt: null,
          lastSaleAt: null,
          hasEstimatedPrice: false,
        }))
      : [],
  };
  const session = { storeId: "store", storeName: "Store", userId: "manager", name: "Manager", role: "MANAGER" };
  const replacements = [
    { getApiSession: async () => session },
    { getSession: async () => ({ ...session, role: "OWNER" }) },
    { prisma: fakePrisma },
  ];
  paths.forEach((path, index) => {
    require.cache[path] = { id: path, filename: path, loaded: true, exports: replacements[index] } as NodeJS.Module;
  });
  context.after(() => {
    paths.forEach((path, index) => {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    });
  });

  const { default: AdminInventoryPage } = await import("../../app/(dashboard)/admin/inventory/page");
  const initialInventory = await AdminInventoryPage();
  const initialSlots = (initialInventory as unknown as { props: { slots: Array<{ slotNumber: string }> } }).props.slots;
  assertNumericDisplays(initialSlots, "slotNumber");

  const { InventoryPos } = await import("../../components/inventory/inventory-pos");
  const inventoryMarkup = renderToStaticMarkup(createElement(InventoryPos, { packs: [], slots: displaySlots.map((slot) => ({ id: slot.id, slotNumber: slot.slotNumber, pack: null })) }));
  const renderedDisplayLabels = [...inventoryMarkup.matchAll(/>Display ([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.deepEqual(renderedDisplayLabels, expectedDisplays, "the rendered live map keeps numeric order for shuffled props");

  const { sortPhysicalAuditLines } = await import("../../components/inventory/physical-audit-panel");
  const auditLines = shuffledDisplays.map((slotNumber) => ({
    id: `audit-line-${slotNumber}`,
    packId: `pack-${slotNumber}`,
    slotNumber,
    expectedTicket: 8,
    endingExpectedTicket: 8,
    variance: 0,
    beginningPhysicalTicket: 10,
    endingPhysicalTicket: 8,
    pack: { serialNumber: `SERIAL-${slotNumber}`, game: { name: `Game ${slotNumber}` } },
  }));
  assert.deepEqual(sortPhysicalAuditLines(auditLines).map((line) => line.slotNumber), expectedDisplays, "physical-audit checklist rows sort numerically");

  const { getDisplaySlots } = await import("../services/display-slots");
  const serviceSlots = await getDisplaySlots("store");
  assert.deepEqual(serviceSlots.map((slot: { slotNumber: string }) => slot.slotNumber), expectedDisplays);

  const { GET: getDisplaySlotsApi } = await import("../../app/api/display-slots/route");
  const displaySlotsResponse = await getDisplaySlotsApi();
  assert.deepEqual((await displaySlotsResponse.json()).map((slot: { slotNumber: string }) => slot.slotNumber), expectedDisplays);

  const { GET: getLegacySlotsApi } = await import("../../app/api/slots/route");
  const legacySlotsResponse = await getLegacySlotsApi();
  assert.deepEqual((await legacySlotsResponse.json()).slots.map((slot: { slotNumber: string }) => slot.slotNumber), expectedDisplays);

  const { GET: getInventoryStatus } = await import("../../app/api/pos/inventory-status/route");
  const inventoryStatusResponse = await getInventoryStatus();
  assert.deepEqual((await inventoryStatusResponse.json()).slots.map((slot: { slotNumber: string }) => slot.slotNumber), expectedDisplays);

  const { GET: getAuditStatus } = await import("../../app/api/inventory-audits/[auditId]/route");
  const auditResponse = await getAuditStatus(new NextRequest("http://localhost/api/inventory-audits/audit"), { params: Promise.resolve({ auditId: "audit" }) });
  assert.deepEqual((await auditResponse.json()).activePacks.map((pack: { slotNumber: string }) => pack.slotNumber), expectedDisplays);

  const { GET: getShiftReport } = await import("../../app/api/reports/shifts/route");
  const shiftReportResponse = await getShiftReport(new NextRequest("http://localhost/api/reports/shifts?shiftId=shift"));
  const shiftReport = await shiftReportResponse.json();
  assertNumericDisplays(shiftReport.shifts[0].packSales, "display");
  assertNumericDisplays(shiftReport.shifts[0].audit, "display");
  assertNumericDisplays(shiftReport.shifts[0].operatorSessions[0].packs, "display");
});
