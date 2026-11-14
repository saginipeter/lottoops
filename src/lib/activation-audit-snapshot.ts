import type { Prisma } from "@prisma/client";
import { getActivationStartingTicket, getAuditPhysicalTicket, getSafeCurrentTicket } from "@/lib/ticket-quantity";
import { remainingTicketsFromPhysicalTicket } from "@/lib/core-validation";

export class ActivationAuditConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActivationAuditConflict";
  }
}

/**
 * Activation and sale/close operations share inventory. Always lock every open
 * shift first, then the active inventory and target pack rows, matching the
 * sale, audit, and close lock order.
 */
export async function lockPackActivation(
  tx: Prisma.TransactionClient,
  storeId: string,
  packIds: string[],
  slotIds: string[],
) {
  const shifts = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM shifts WHERE "storeId" = $1 AND status = 'OPEN' ORDER BY id FOR UPDATE`,
    storeId,
  );

  await tx.$queryRawUnsafe(
    `SELECT id FROM packs WHERE "storeId" = $1 AND (status = 'ACTIVE' OR id = ANY($2::text[])) ORDER BY id FOR UPDATE`,
    storeId,
    packIds,
  );
  await tx.$queryRawUnsafe(
    `SELECT id FROM display_slots WHERE "storeId" = $1 AND id = ANY($2::text[]) ORDER BY id FOR UPDATE`,
    storeId,
    slotIds,
  );

  if (shifts.length > 0) {
    const completedAudits = await tx.inventoryAudit.findMany({
      where: { shiftId: { in: shifts.map((shift) => shift.id) }, status: "COMPLETED" },
      select: { id: true },
    });
    if (completedAudits.length > 0) {
      throw new ActivationAuditConflict("A closing audit is already complete for an open shift. Close the shift before activating more packs.");
    }
  }

  return shifts.map((shift) => shift.id);
}

export interface PackActivationInput {
  storeId: string;
  packId: string;
  slotId: string;
  actorId: string;
  firstOrLastTicket?: string | null;
  startingTicketNumber?: number;
  activationNumber?: string | null;
  activationReceipt?: string | null;
  activationReceiptPhoto?: string | null;
  lotNumber?: string | null;
  detail?: string;
  allowedCurrentStatus?: "BACK_STOCK" | "RECEIVING";
}

export async function activatePackToDisplay(
  tx: Prisma.TransactionClient,
  input: PackActivationInput,
) {
  await lockPackActivation(tx, input.storeId, [input.packId], [input.slotId]);
  const [pack, slot] = await Promise.all([
    tx.pack.findFirst({
      where: { id: input.packId, storeId: input.storeId },
      include: { game: true },
    }),
    tx.displaySlot.findFirst({ where: { id: input.slotId, storeId: input.storeId } }),
  ]);
  if (!pack) throw new ActivationAuditConflict("Pack not found or outside this store.");
  if (pack.status !== (input.allowedCurrentStatus ?? "BACK_STOCK")) {
    throw new ActivationAuditConflict(`Only ${input.allowedCurrentStatus === "RECEIVING" ? "receiving" : "back-stock"} packs can be activated.`);
  }
  if (!slot) throw new ActivationAuditConflict("Display not found or outside this store.");
  if (slot.packId) throw new ActivationAuditConflict("Display is already occupied.");

  const direction = input.firstOrLastTicket === "LAST" ? "LAST" : "FIRST";
  const quantity = Number(pack.ticketQuantity ?? pack.game.ticketsPerPack ?? 0);
  const firstTicket = Number(pack.firstTicket ?? 1);
  const startingTicket = input.startingTicketNumber ?? getActivationStartingTicket({
    currentTicketNumber: pack.currentTicketNumber,
    firstTicket: pack.firstTicket,
    ticketQuantity: quantity,
    firstOrLastTicket: direction,
  });
  if (startingTicket === null || !Number.isInteger(startingTicket) || startingTicket < 1 || startingTicket > quantity || startingTicket < firstTicket) {
    throw new ActivationAuditConflict("Pack has invalid ticket data. Set a valid first ticket and quantity before activation.");
  }
  const currentTicketNumber = remainingTicketsFromPhysicalTicket(firstTicket, quantity, startingTicket, direction);
  if (currentTicketNumber === null) throw new ActivationAuditConflict("Pack has an invalid starting ticket for the selected ticket-tracking direction.");

  const activated = await tx.pack.update({
    where: { id: pack.id },
    data: {
      status: "ACTIVE",
      activatedAt: new Date(),
      currentTicketNumber,
      firstOrLastTicket: direction,
      activationNumber: input.activationNumber || undefined,
      activationReceipt: input.activationReceipt || undefined,
      activationReceiptPhoto: input.activationReceiptPhoto || undefined,
      lotNumber: input.lotNumber || undefined,
    },
    include: { game: true, slot: true },
  });
  const slotUpdated = await tx.displaySlot.updateMany({
    where: { id: slot.id, storeId: input.storeId, packId: null },
    data: { packId: pack.id },
  });
  if (slotUpdated.count !== 1) throw new ActivationAuditConflict("Display was assigned by another operation. Refresh and try again.");
  await tx.scanLogEntry.create({
    data: {
      storeId: input.storeId,
      action: "ACTIVATED",
      packId: pack.id,
      performedById: input.actorId,
      detail: input.detail ?? `Activated pack to display ${slot.slotNumber}`,
    },
  });
  await recordActivationInOpenAudits(tx, input.storeId, [{ id: pack.id, slotNumber: slot.slotNumber }]);
  return activated;
}

export async function assignActivePackToDisplay(
  tx: Prisma.TransactionClient,
  input: Pick<PackActivationInput, "storeId" | "actorId" | "packId" | "slotId" | "detail">,
) {
  await lockPackActivation(tx, input.storeId, [input.packId], [input.slotId]);
  const [pack, slot] = await Promise.all([
    tx.pack.findFirst({ where: { id: input.packId, storeId: input.storeId }, include: { game: true } }),
    tx.displaySlot.findFirst({ where: { id: input.slotId, storeId: input.storeId } }),
  ]);
  if (!pack || pack.status !== "ACTIVE") throw new ActivationAuditConflict("Only unassigned active packs can be assigned to a display.");
  if (!slot) throw new ActivationAuditConflict("Display not found or outside this store.");
  if (slot.packId) throw new ActivationAuditConflict("Display is already occupied.");
  const updated = await tx.displaySlot.updateMany({
    where: { id: slot.id, storeId: input.storeId, packId: null },
    data: { packId: pack.id },
  });
  if (updated.count !== 1) throw new ActivationAuditConflict("Display was assigned by another operation.");
  await tx.scanLogEntry.create({
    data: {
      storeId: input.storeId,
      action: "ACTIVATED",
      packId: pack.id,
      performedById: input.actorId,
      detail: input.detail ?? `Assigned active pack to display ${slot.slotNumber}`,
    },
  });
  await recordActivationInOpenAudits(tx, input.storeId, [{ id: pack.id, slotNumber: slot.slotNumber }]);
  return pack;
}

export async function activatePacksToDisplays(
  tx: Prisma.TransactionClient,
  inputs: PackActivationInput[],
) {
  if (inputs.length === 0) return [];
  const storeId = inputs[0].storeId;
  if (inputs.some((input) => input.storeId !== storeId)) {
    throw new ActivationAuditConflict("Packs from different stores cannot be activated together.");
  }
  await lockPackActivation(tx, storeId, inputs.map((item) => item.packId), inputs.map((item) => item.slotId));
  const results = [];
  for (const input of inputs) {
    const [pack, slot] = await Promise.all([
      tx.pack.findFirst({ where: { id: input.packId, storeId }, include: { game: true } }),
      tx.displaySlot.findFirst({ where: { id: input.slotId, storeId } }),
    ]);
    if (!pack || pack.status !== (input.allowedCurrentStatus ?? "BACK_STOCK")) {
      throw new ActivationAuditConflict(`A shipment pack is no longer ${input.allowedCurrentStatus === "RECEIVING" ? "receiving" : "in back stock"}.`);
    }
    if (!slot || slot.packId) throw new ActivationAuditConflict("A destination display is no longer available.");
    const direction = input.firstOrLastTicket === "LAST" ? "LAST" : "FIRST";
    const quantity = Number(pack.ticketQuantity ?? pack.game.ticketsPerPack ?? 0);
    const firstTicket = Number(pack.firstTicket ?? 1);
    const startingTicket = input.startingTicketNumber ?? getActivationStartingTicket({
      currentTicketNumber: pack.currentTicketNumber, firstTicket: pack.firstTicket,
      ticketQuantity: quantity, firstOrLastTicket: direction,
    });
    if (startingTicket === null || !Number.isInteger(startingTicket) || startingTicket < 1 || startingTicket > quantity || startingTicket < firstTicket) {
      throw new ActivationAuditConflict("A shipment pack has invalid ticket data and cannot be activated.");
    }
    const currentTicketNumber = remainingTicketsFromPhysicalTicket(firstTicket, quantity, startingTicket, direction);
    if (currentTicketNumber === null) throw new ActivationAuditConflict("A shipment pack has an invalid starting ticket for the selected ticket-tracking direction.");
    const activated = await tx.pack.update({
      where: { id: pack.id },
      data: {
        status: "ACTIVE", activatedAt: new Date(), currentTicketNumber, firstOrLastTicket: direction,
        activationNumber: input.activationNumber || undefined,
        activationReceipt: input.activationReceipt || undefined,
        activationReceiptPhoto: input.activationReceiptPhoto || undefined,
        lotNumber: input.lotNumber || undefined,
      },
      include: { game: true, slot: true },
    });
    const slotUpdated = await tx.displaySlot.updateMany({
      where: { id: slot.id, storeId, packId: null }, data: { packId: pack.id },
    });
    if (slotUpdated.count !== 1) throw new ActivationAuditConflict("A destination display was assigned by another operation.");
    await tx.scanLogEntry.create({
      data: {
        storeId, action: "ACTIVATED", packId: pack.id, performedById: input.actorId,
        detail: input.detail ?? `Activated pack to display ${slot.slotNumber}`,
      },
    });
    results.push({ id: pack.id, slotNumber: slot.slotNumber, pack: activated });
  }
  await recordActivationInOpenAudits(tx, storeId, results.map(({ id, slotNumber }) => ({ id, slotNumber })));
  return results.map(({ pack }) => pack);
}

type ActivatedPack = { id: string; slotNumber: string };

interface ActivePackSnapshot {
  id: string;
  currentTicketNumber: number | null;
  firstTicket: number | null;
  ticketQuantity: number | null;
  firstOrLastTicket: string | null;
  slot: { slotNumber: string } | null;
  game: { ticketsPerPack: number | null };
}

/**
 * Called inside the same activation transaction after pack/display writes.
 * New packs are snapshotted only if every pre-existing active display already
 * has a completed opening baseline. Otherwise they receive an explicit blank
 * beginning line and still require the normal physical scan.
 */
export async function recordActivationInOpenAudits(
  tx: Prisma.TransactionClient,
  storeId: string,
  activatedPacks: ActivatedPack[],
) {
  if (activatedPacks.length === 0) return;
  const activatedIds = new Set(activatedPacks.map((pack) => pack.id));
  const shifts = await tx.shift.findMany({
    where: { storeId, status: "OPEN" },
    select: { id: true },
  });
  if (shifts.length === 0) return;

  const audits = await tx.inventoryAudit.findMany({
    where: { shiftId: { in: shifts.map((shift) => shift.id) }, status: "OPEN" },
    include: { lines: true },
  });
  if (audits.length === 0) return;

  const activePacks = await tx.pack.findMany({
    where: { storeId, status: "ACTIVE", slot: { isNot: null } },
    select: {
      id: true,
      currentTicketNumber: true,
      firstTicket: true,
      ticketQuantity: true,
      firstOrLastTicket: true,
      slot: { select: { slotNumber: true } },
      game: { select: { ticketsPerPack: true } },
    },
  }) as ActivePackSnapshot[];

  for (const audit of audits) {
    const lineByPack = new Map(audit.lines.map((line: { packId: string }) => [line.packId, line]));
    const preexistingActivePacks = activePacks.filter((pack) => !activatedIds.has(pack.id));
    const openingComplete = preexistingActivePacks.every((pack) => {
      const line = lineByPack.get(pack.id) as { beginningPhysicalTicket: number | null } | undefined;
      return line?.beginningPhysicalTicket !== null && line?.beginningPhysicalTicket !== undefined;
    });

    for (const activated of activatedPacks) {
      if (lineByPack.has(activated.id)) continue;
      const pack = activePacks.find((item) => item.id === activated.id);
      if (!pack) throw new ActivationAuditConflict("An activated pack could not be found while saving its audit baseline.");
      const quantity = Number(pack.ticketQuantity ?? pack.game.ticketsPerPack ?? 0);
      const expectedTicket = getAuditPhysicalTicket({
        currentTicketNumber: pack.currentTicketNumber,
        firstTicket: pack.firstTicket,
        ticketQuantity: quantity,
        firstOrLastTicket: pack.firstOrLastTicket,
      });
      const beginningPhysicalTicket = openingComplete ? expectedTicket : null;
      const line = await tx.inventoryAuditLine.create({
        data: {
          auditId: audit.id,
          packId: pack.id,
          slotNumber: pack.slot?.slotNumber ?? activated.slotNumber,
          expectedTicket,
          beginningPhysicalTicket,
          beginningSource: openingComplete ? "ACTIVATION_SNAPSHOT" : "AWAITING_PHYSICAL_SCAN",
        },
      });
      lineByPack.set(pack.id, line);

      if (openingComplete) {
        const beginningTicket = getSafeCurrentTicket({
          currentTicketNumber: pack.currentTicketNumber,
          firstTicket: pack.firstTicket,
          ticketQuantity: quantity,
        });
        await tx.shiftLine.upsert({
          where: { shiftId_packId: { shiftId: audit.shiftId, packId: pack.id } },
          create: {
            shiftId: audit.shiftId,
            packId: pack.id,
            slotNumber: pack.slot?.slotNumber ?? activated.slotNumber,
            beginningTicket,
          },
          update: {},
        });
      }
    }
  }
}
