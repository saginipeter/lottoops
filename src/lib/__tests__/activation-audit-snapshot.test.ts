import assert from "node:assert/strict";
import test from "node:test";
import { activatePackToDisplay, recordActivationInOpenAudits } from "../activation-audit-snapshot";
import { getAuditPhysicalTicket } from "../ticket-quantity";

function fixture() {
  const createdLines: Array<Record<string, unknown>> = [];
  const shiftLineCreates: Array<Record<string, unknown>> = [];
  const shifts = [{ id: "shift-complete" }, { id: "shift-incomplete" }];
  const audits = [
    { id: "audit-complete", shiftId: "shift-complete", lines: [{ packId: "existing", beginningPhysicalTicket: 3 }] },
    { id: "audit-incomplete", shiftId: "shift-incomplete", lines: [{ packId: "existing", beginningPhysicalTicket: null }] },
  ];
  const tx = {
    shift: { findMany: async () => shifts },
    inventoryAudit: { findMany: async () => audits },
    pack: {
      findMany: async () => [
        { id: "existing", currentTicketNumber: 8, firstTicket: 3, ticketQuantity: 10, firstOrLastTicket: "FIRST", slot: { slotNumber: "2" }, game: { ticketsPerPack: 10 } },
        { id: "new", currentTicketNumber: 8, firstTicket: 3, ticketQuantity: 10, firstOrLastTicket: "FIRST", slot: { slotNumber: "5" }, game: { ticketsPerPack: 10 } },
      ],
    },
    inventoryAuditLine: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const line = { ...data, id: `line-${createdLines.length + 1}` };
        createdLines.push(line);
        return line;
      },
    },
    shiftLine: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        shiftLineCreates.push(create);
        return create;
      },
    },
  };
  return { tx, createdLines, shiftLineCreates };
}

test("new active packs are auto-baselined only for shifts with a complete opening audit", async () => {
  const { tx, createdLines, shiftLineCreates } = fixture();
  await recordActivationInOpenAudits(tx as never, "store", [{ id: "new", slotNumber: "5" }]);

  assert.equal(createdLines.length, 2, "the shared active inventory is represented in each open shift audit");
  const complete = createdLines.find((line) => line.auditId === "audit-complete");
  const incomplete = createdLines.find((line) => line.auditId === "audit-incomplete");
  assert.equal(complete?.expectedTicket, 3);
  assert.equal(complete?.beginningPhysicalTicket, 3);
  assert.equal(complete?.beginningSource, "ACTIVATION_SNAPSHOT");
  assert.equal(incomplete?.beginningPhysicalTicket, null);
  assert.equal(incomplete?.beginningSource, "AWAITING_PHYSICAL_SCAN");
  assert.deepEqual(shiftLineCreates, [{ shiftId: "shift-complete", packId: "new", slotNumber: "5", beginningTicket: 8 }]);
});

test("opening baseline helper does not invent physical scans when an active pack is absent from coverage", async () => {
  const { tx, createdLines, shiftLineCreates } = fixture();
  tx.inventoryAudit.findMany = async () => [
    { id: "audit-incomplete", shiftId: "shift-incomplete", lines: [] },
  ];
  tx.shift.findMany = async () => [{ id: "shift-incomplete" }];
  await recordActivationInOpenAudits(tx as never, "store", [{ id: "new", slotNumber: "5" }]);
  assert.equal(createdLines.length, 1);
  assert.equal(createdLines[0].beginningPhysicalTicket, null);
  assert.equal(createdLines[0].beginningSource, "AWAITING_PHYSICAL_SCAN");
  assert.equal(shiftLineCreates.length, 0);
});

test("partial packs activate at their available count and preserve physical start in either direction", async () => {
  for (const direction of ["FIRST", "LAST"] as const) {
    const activationCapture: { data: Record<string, unknown> | null } = { data: null };
    const pack = { id: "partial", storeId: "store", status: "BACK_STOCK", currentTicketNumber: null, firstTicket: 25, ticketQuantity: 50, firstOrLastTicket: null, game: { ticketsPerPack: 50 } };
    const tx = {
      $queryRawUnsafe: async (sql: string) => sql.includes("FROM shifts") ? [] : [],
      pack: {
        findFirst: async () => pack,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          activationCapture.data = data;
          return { ...pack, ...data, game: pack.game, slot: { slotNumber: "05" } };
        },
      },
      displaySlot: {
        findFirst: async () => ({ id: "display", storeId: "store", slotNumber: "05", packId: null }),
        updateMany: async () => ({ count: 1 }),
      },
      scanLogEntry: { create: async () => ({}) },
      shift: { findMany: async () => [] },
    };
    await activatePackToDisplay(tx as never, { storeId: "store", packId: "partial", slotId: "display", actorId: "manager", firstOrLastTicket: direction });
    assert.equal(activationCapture.data?.currentTicketNumber, 26);
    assert.equal(activationCapture.data?.firstOrLastTicket, direction);
    assert.equal(getAuditPhysicalTicket({
      currentTicketNumber: activationCapture.data?.currentTicketNumber as number,
      firstTicket: 25,
      ticketQuantity: 50,
      firstOrLastTicket: direction,
    }), direction === "LAST" ? 50 : 25);
  }
});
