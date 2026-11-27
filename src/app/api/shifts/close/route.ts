import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { validateEndingTicket } from "@/lib/core-validation";
import { calculatePhysicalAuditVariance } from "@/lib/core-validation";
import { getAuditPhysicalTicket } from "@/lib/ticket-quantity";
import { logInventoryActivity } from "@/lib/activity-log";
import { createInventoryNotification } from "@/lib/inventory-notifications";
import { isReadOnly } from "@/lib/permissions";

class CloseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isReadOnly(session)) return NextResponse.json({ error: "Auditor accounts are read-only." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  try {
    const body = await req.json().catch(() => ({}));
    const shiftId = typeof body?.shiftId === "string" ? body.shiftId.trim() : "";
    const registerAmountInput = body?.registerScratchOffSales;
    const registerAmountProvided = (typeof registerAmountInput === "number" && Number.isFinite(registerAmountInput)) ||
      (typeof registerAmountInput === "string" && registerAmountInput.trim() !== "");
    const registerScratchOffSales = registerAmountProvided ? Number(registerAmountInput) : Number.NaN;
    if (!shiftId) return NextResponse.json({ error: "Shift ID is required." }, { status: 400 });
    if ((session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD") && session.shiftId !== shiftId) {
      return NextResponse.json({ error: "You can only close the numbered shift assigned to your current session." }, { status: 403 });
    }
    if (!registerAmountProvided || !Number.isFinite(registerScratchOffSales) || registerScratchOffSales < 0) {
      return NextResponse.json({ error: "Enter a valid Register Scratch Off Sales amount before closing this shift." }, { status: 409 });
    }
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Returns and sales lock the shift before packs. Read inventory only after both locks.
      await tx.$queryRawUnsafe(
        `SELECT id FROM shifts WHERE id = $1 AND "storeId" = $2 FOR UPDATE`,
        shiftId, session.storeId,
      );
      await tx.$queryRawUnsafe(`
        SELECT p.id FROM packs p
        WHERE p."storeId" = $2 AND (
          p.id IN (SELECT l."packId" FROM shift_lines l WHERE l."shiftId" = $1)
          OR (p.status = 'ACTIVE' AND p.id IN (SELECT d."packId" FROM display_slots d WHERE d."packId" IS NOT NULL))
        )
        ORDER BY p.id FOR UPDATE
      `, shiftId, session.storeId);
      const shift = await tx.shift.findUnique({
        where: { id: shiftId },
        include: { lines: { include: { pack: { include: { game: true } } } } },
      });
      if (!shift) throw new CloseError("Shift not found.", 404);
      if (shift.storeId !== session.storeId) throw new CloseError("Access denied.", 403);
      if (shift.status !== "OPEN") throw new CloseError("Shift is already closed.", 400);

      const terminalId = shift.terminalId ?? "T1";
      const audit = await tx.inventoryAudit.findUnique({
        where: { shiftId: shift.id },
        select: {
          id: true, status: true,
          // Only packs still active on a display belong to the closing-audit
          // scope. Packs sold out or removed after opening can retain
          // historical lines without blocking shift close.
          lines: {
            where: { pack: { status: "ACTIVE", slot: { isNot: null } } },
            select: { id: true, packId: true, beginningPhysicalTicket: true, endingPhysicalTicket: true, endingExpectedTicket: true },
          },
        },
      });
      const activeDisplayPacks = await tx.pack.findMany({
        where: { storeId: session.storeId, status: "ACTIVE", slot: { isNot: null } },
        select: {
          id: true, serialNumber: true, packNumber: true, currentTicketNumber: true,
          firstTicket: true, ticketQuantity: true, firstOrLastTicket: true,
          game: { select: { ticketsPerPack: true, gameNumber: true } },
        },
      }) as Array<{
        id: string; serialNumber: string; packNumber: string | null; currentTicketNumber: number | null;
        firstTicket: number | null; ticketQuantity: number | null; firstOrLastTicket: string | null;
        game: { ticketsPerPack: number | null; gameNumber: string };
      }>;
      const auditLineByPack = new Map((audit?.lines ?? []).map((line) => [line.packId, line]));
      const openingAuditIncomplete = !audit || activeDisplayPacks.some((pack) => auditLineByPack.get(pack.id)?.beginningPhysicalTicket == null);
      const closingAuditIncomplete = !audit || activeDisplayPacks.some((pack) => auditLineByPack.get(pack.id)?.endingPhysicalTicket == null);
      const activeDisplayPackCount = activeDisplayPacks.length;
      if (activeDisplayPackCount > 0 && openingAuditIncomplete) {
        throw new CloseError("Complete the Opening Audit before starting the Closing Audit.", 409);
      }
      if (activeDisplayPackCount > 0 && (closingAuditIncomplete || (audit?.status !== "OPEN" && audit?.status !== "COMPLETED"))) {
        throw new CloseError("Scan the ending ticket on every active display before closing this shift.", 409);
      }

      const closedAt = new Date();
      let completedAudit: {
        auditId: string;
        varianceLines: Array<{ lineId: string; packId: string; packNumber: string | null; gameNumber: string; expected: number; observed: number; variance: number }>;
      } | null = null;
      if (audit?.status === "OPEN") {
        const resolved = activeDisplayPacks.map((pack) => {
          const line = auditLineByPack.get(pack.id);
          if (!line || line.endingPhysicalTicket == null) {
            throw new CloseError("Scan the ending ticket on every active display before closing this shift.", 409);
          }
          const expected = getAuditPhysicalTicket({
            currentTicketNumber: pack.currentTicketNumber,
            firstTicket: pack.firstTicket,
            ticketQuantity: pack.ticketQuantity ?? pack.game.ticketsPerPack,
            firstOrLastTicket: pack.firstOrLastTicket,
          });
          if (line.endingExpectedTicket != null && Number(line.endingExpectedTicket) !== expected) {
            throw new CloseError(`Display position changed after its ending scan for pack ${pack.serialNumber}. Rescan this pack before closing the shift.`, 409);
          }
          const observed = Number(line.endingPhysicalTicket);
          const variance = calculatePhysicalAuditVariance(expected, observed) ?? 0;
          return { line, pack, expected, observed, variance };
        });
        for (const { line, expected, variance } of resolved) {
          await tx.inventoryAuditLine.update({ where: { id: line.id }, data: { endingExpectedTicket: expected, variance } });
        }
        await tx.inventoryAudit.update({
          where: { id: audit.id },
          data: { status: "COMPLETED", endedById: session.userId, endedAt: closedAt },
        });
        completedAudit = {
          auditId: audit.id,
          varianceLines: resolved.filter(({ variance }) => variance !== 0).map(({ line, pack, expected, observed, variance }) => ({
            lineId: line.id,
            packId: pack.id,
            packNumber: pack.packNumber,
            gameNumber: pack.game.gameNumber,
            expected,
            observed,
            variance,
          })),
        };
      }

      const salesByPackRows = await tx.$queryRawUnsafe<Array<{ packId: string; ticketsSold: number | bigint; ticketValue: number | string }>>(
        `SELECT pack_id AS "packId", COUNT(*)::int AS "ticketsSold", COALESCE(SUM(ticket_price), 0)::numeric AS "ticketValue" FROM live_scan_events WHERE store_id = $1 AND shift_id = $2 GROUP BY pack_id`,
        session.storeId, shift.id,
      );
      const salesByPack = new Map(salesByPackRows.map((row) => [row.packId, { tickets: Number(row.ticketsSold), value: Number(row.ticketValue) }]));

      let totalSales = 0;
      let totalTickets = 0;
      for (const line of shift.lines) {
        const beginning = line.beginningTicket;
        const tracked = salesByPack.get(line.packId);
        const ticketsSold = tracked?.tickets ?? 0;
        const sharedCurrent = Number(line.pack.currentTicketNumber ?? 0);
        const firstTicket = Number(line.pack.firstTicket ?? 1);
        const ticketQuantity = Number(line.pack.ticketQuantity ?? line.pack.game.ticketsPerPack ?? 0);
        const maximumRemaining = Math.max(ticketQuantity - firstTicket + 1, 0);
        if (!Number.isInteger(sharedCurrent) || sharedCurrent < 0 || sharedCurrent > maximumRemaining ||
            (line.pack.status === "ACTIVE" && sharedCurrent === 0) || (line.pack.status === "SOLD_OUT" && sharedCurrent !== 0)) {
          throw new CloseError(`The shared ticket position for pack ${line.pack.serialNumber} needs manager correction before closing.`, 409);
        }
        if (!Number.isInteger(beginning) || beginning < 0 || !Number.isInteger(ticketsSold) || ticketsSold < 0 || ticketsSold > beginning) {
          throw new CloseError(`The tracked ticket count for pack ${line.pack.serialNumber} exceeds this shift's opening balance.`, 409);
        }
        const ending = beginning - ticketsSold;
        const ticketError = validateEndingTicket(beginning, ending);
        if (ticketError) {
          throw new CloseError(`Invalid shift-local ending ticket for pack ${line.pack.serialNumber}. ${ticketError}`, 409);
        }
        const sales = tracked?.value ?? 0;
        totalTickets += ticketsSold;
        totalSales += sales;
        await tx.shiftLine.update({
          where: { id: line.id }, data: { endingTicket: ending, ticketsSold, salesAmount: sales },
        });
      }
      await tx.shift.update({
        where: { id: shift.id },
        data: {
          registerScratchOffSales,
          registerScratchOffSalesRecordedAt: closedAt,
          registerScratchOffSalesRecordedById: session.userId,
          status: "CLOSED",
          closedAt,
          closedById: session.userId,
        },
      });
      await tx.$executeRawUnsafe(
        `UPDATE login_sessions SET ended_at = COALESCE(ended_at, NOW()) WHERE store_id = $1 AND shift_id = $2 AND ended_at IS NULL`,
        session.storeId, shift.id,
      );
      await tx.scanLogEntry.create({
        data: { storeId: session.storeId, action: "SHIFT_CLOSE", performedById: session.userId, detail: `Shift ${shift.shiftNumber ?? "Unnumbered"} closed on terminal ${terminalId}.` },
      });
      return {
        terminalId,
        totalTickets,
        systemTrackedSales: totalSales,
        registerScratchOffSales,
        salesVariance: registerScratchOffSales - totalSales,
        completedAudit,
      };
    });
    const { terminalId, completedAudit, ...totals } = result;
    if (completedAudit) {
      await logInventoryActivity({
        storeId: session.storeId,
        action: "ENDING_AUDIT_COMPLETED",
        entityType: "SHIFT",
        entityId: shiftId,
        detail: `Ending inventory audit completed with ${completedAudit.varianceLines.length} variance(s) as part of shift close.`,
        performedById: session.userId,
        performedByName: session.name,
        terminalId,
      }).catch((error) => console.warn("Unable to log ending audit completion", error));
      await Promise.all(completedAudit.varianceLines.map((line: {
        lineId: string; packId: string; packNumber: string | null; gameNumber: string;
        expected: number; observed: number; variance: number;
      }) => createInventoryNotification({
        storeId: session.storeId,
        type: "INVENTORY_AUDIT_VARIANCE",
        entityId: line.lineId,
        packId: line.packId,
        title: "Physical audit variance requires review",
        detail: `Pack #${line.packNumber ?? "not recorded"} · Game #${line.gameNumber}: expected physical ticket ${line.expected}, observed ${line.observed}.`,
        severity: "URGENT",
      }).catch((error) => console.warn("Unable to create audit variance notification", error))));
    }
    await logInventoryActivity({
      storeId: session.storeId, action: "SHIFT_CLOSE", entityType: "SHIFT", entityId: shiftId,
      detail: "Shift closed successfully.", performedById: session.userId,
      performedByName: session.name, terminalId,
    });
    return NextResponse.json({ success: true, ...totals });
  } catch (error) {
    if (error instanceof CloseError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Shift inventory changed. Refresh before closing again." }, { status: 409 });
    }
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Unable to close shift. ${message}` }, { status: 500 });
  }
}
