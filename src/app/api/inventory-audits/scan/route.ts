import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { logInventoryActivity } from "@/lib/activity-log";
import { recordShiftParticipant } from "@/lib/shift-participants";
import { getAuditPhysicalTicket, getSafeCurrentTicket } from "@/lib/ticket-quantity";
import { calculatePhysicalAuditInventory } from "@/lib/core-validation";

class AuditScanError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

type AuditScanResult = {
  updated: Record<string, unknown>;
  shiftId: string;
  packId: string;
  serialNumber: string;
  gameName: string;
  slotNumber: string;
  remaining: number;
  scannedSoldTicket: boolean;
};

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role === "AUDITOR") return NextResponse.json({ error: "Auditor accounts are read-only." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const auditId = typeof body?.auditId === "string" ? body.auditId.trim() : "";
  const phase = body?.phase;
  if (!auditId || !body?.serialNumber || !["beginning", "ending"].includes(phase)) {
    return NextResponse.json({ error: "auditId, barcode, and phase are required." }, { status: 400 });
  }
  const barcode = String(body.serialNumber).trim().replace(/\D/g, "");
  if (!/^\d{14}$/.test(barcode)) {
    return NextResponse.json({ error: "Scan the complete 14-digit ticket barcode. The last 3 digits are recorded as the physical ticket." }, { status: 400 });
  }
  const serialNumber = barcode.slice(0, 11);
  const physicalTicket = Number(barcode.slice(11));
  if (!Number.isSafeInteger(physicalTicket) || physicalTicket < 0) {
    return NextResponse.json({ error: "Enter the physical ticket number shown on the pack." }, { status: 400 });
  }

  try {
    // The preliminary read obtains the shift lock key; all authoritative state is re-read under locks.
    const initialAudit = await prisma.inventoryAudit.findFirst({
      where: { id: auditId, storeId: session.storeId },
      select: { shiftId: true },
    });
    if (!initialAudit) return NextResponse.json({ error: "Open audit not found." }, { status: 404 });
    if ((session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD") && session.shiftId !== initialAudit.shiftId) {
      return NextResponse.json({ error: "You can only scan the audit for your assigned numbered shift." }, { status: 403 });
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<AuditScanResult> => {
      const lockedShift = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM shifts WHERE id = $1 AND "storeId" = $2 AND status = 'OPEN' FOR UPDATE`,
        initialAudit.shiftId, session.storeId,
      );
      if (lockedShift.length === 0) throw new AuditScanError("The numbered shift is no longer open.", 409);
      const audit = await tx.inventoryAudit.findFirst({
        where: { id: auditId, storeId: session.storeId, shiftId: initialAudit.shiftId, status: "OPEN" },
        include: { lines: true },
      });
      if (!audit) throw new AuditScanError("Open audit not found.", 404);

      await tx.$queryRawUnsafe(`
        SELECT p.id FROM packs p
        JOIN display_slots d ON d."packId" = p.id
        WHERE p."storeId" = $1 AND p."serialNumber" = $2 AND p.status = 'ACTIVE'
        ORDER BY p.id FOR UPDATE OF p
      `, session.storeId, serialNumber);
      const pack = await tx.pack.findFirst({
        where: { storeId: session.storeId, serialNumber, status: "ACTIVE", slot: { isNot: null } },
        select: {
          id: true, currentTicketNumber: true, firstTicket: true, ticketQuantity: true, firstOrLastTicket: true,
          slot: { select: { slotNumber: true } },
          game: { select: { ticketsPerPack: true, name: true } },
        },
      });
      if (!pack) throw new AuditScanError("Only active packs assigned to a display can be audited.", 404);

      const expectedPhysicalTicket = getAuditPhysicalTicket({
        currentTicketNumber: pack.currentTicketNumber,
        firstTicket: pack.firstTicket,
        ticketQuantity: pack.ticketQuantity ?? pack.game.ticketsPerPack,
        firstOrLastTicket: pack.firstOrLastTicket,
      });
      let line = audit.lines.find((item: { packId: string }) => item.packId === pack.id);
      if (!line) {
        if (phase !== "beginning") throw new AuditScanError("Record this pack in the Opening Audit before its Closing Audit.", 409);
        line = await tx.inventoryAuditLine.create({
          data: { auditId: audit.id, packId: pack.id, slotNumber: pack.slot?.slotNumber ?? "", expectedTicket: expectedPhysicalTicket },
        });
      }
      if (phase === "ending" && line.beginningPhysicalTicket === null) {
        throw new AuditScanError("Record this pack in the Opening Audit before its Closing Audit.", 409);
      }

      const ticketQuantity = Number(pack.ticketQuantity ?? pack.game.ticketsPerPack ?? 0);
      if (ticketQuantity > 0 && physicalTicket > ticketQuantity) {
        throw new AuditScanError(`Physical ticket must be between 0 and ${ticketQuantity}.`, 400);
      }
      const currentRemaining = pack.currentTicketNumber === 0 ? 0 : getSafeCurrentTicket({
        currentTicketNumber: pack.currentTicketNumber,
        firstTicket: pack.firstTicket,
        ticketQuantity,
      });
      const inventory = calculatePhysicalAuditInventory(
        pack.firstTicket ?? 1,
        ticketQuantity,
        currentRemaining,
        physicalTicket,
        pack.firstOrLastTicket,
      );
      if (!inventory) throw new AuditScanError("Physical ticket is outside this pack's inventory range.", 400);

      const data = phase === "beginning"
        ? { beginningPhysicalTicket: physicalTicket, beginningSource: "PHYSICAL_SCAN", expectedTicket: expectedPhysicalTicket, variance: inventory.variance }
        : { endingPhysicalTicket: physicalTicket, endingExpectedTicket: expectedPhysicalTicket, variance: inventory.variance };
      const updated = await tx.inventoryAuditLine.update({
        where: { id: line.id },
        data,
        include: { pack: { select: { serialNumber: true, game: { select: { name: true } } } } },
      });
      if (phase === "beginning") {
        await tx.shiftLine.upsert({
          where: { shiftId_packId: { shiftId: audit.shiftId, packId: pack.id } },
          create: { shiftId: audit.shiftId, packId: pack.id, slotNumber: pack.slot?.slotNumber ?? "", beginningTicket: currentRemaining },
          update: {},
        });
      }
      return {
        updated,
        shiftId: audit.shiftId,
        packId: pack.id,
        serialNumber: updated.pack?.serialNumber ?? serialNumber,
        gameName: updated.pack?.game?.name ?? "Lottery ticket",
        slotNumber: pack.slot?.slotNumber ?? "",
        remaining: inventory.remaining,
        scannedSoldTicket: inventory.scannedSoldTicket,
      };
    }, { isolationLevel: "Serializable" });

    await recordShiftParticipant(result.shiftId, session.userId).catch((error) => console.warn("Unable to record shift participant", error));
    await logInventoryActivity({
      storeId: session.storeId,
      action: phase === "beginning" ? "BEGINNING_AUDIT_SCAN" : "ENDING_AUDIT_SCAN",
      entityType: "PACK",
      entityId: result.packId,
      detail: `${phase} physical ticket recorded as ${physicalTicket} for audit ${auditId}.`,
      performedById: session.userId,
      performedByName: session.name,
    }).catch((error) => console.warn("Unable to log physical audit activity", error));
    return NextResponse.json({ ...result.updated, remaining: result.remaining, scannedSoldTicket: result.scannedSoldTicket });
  } catch (error) {
    if (error instanceof AuditScanError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[POST /api/inventory-audits/scan]", error);
    return NextResponse.json({ error: "Unable to record audit scan." }, { status: 500 });
  }
}
