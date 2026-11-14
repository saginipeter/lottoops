import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { authorizeRegisteredDevice } from "@/lib/device-registry";
import { logInventoryActivity } from "@/lib/activity-log";
import { canSelfResolveSequenceLock } from "@/lib/control-validation";
import { createInventoryNotification } from "@/lib/inventory-notifications";
import { isReadOnly } from "@/lib/permissions";
import { calculateTicketSaleSplit } from "@/lib/ticket-sales";
import { getSafeCurrentTicket, getValidTicketState } from "@/lib/ticket-quantity";
import { Prisma } from "@prisma/client";
import { expectedPhysicalTicketByDirection } from "@/lib/core-validation";
import { isValidPackBarcode } from "@/lib/barcode";
import { normalizeTerminalId } from "@/lib/device-registry";

function resolveScannedTicketNumber(normalizedSerial: string) {
  if (normalizedSerial.length <= 11) return null;

  const ticketSuffix = normalizedSerial.substring(11);
  if (ticketSuffix.length > 3) return null;

  const ticketNumber = Number(ticketSuffix);
  return Number.isInteger(ticketNumber) && ticketNumber > 0
    ? ticketNumber
    : null;
}

class LiveScanError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

function saleResponse({
  pack, shiftId, shiftNumber, saleId, ticketBarcode, currentTicketNumber, packStatus,
  ticketsSold = 1, salesAmount, replayed = false, terminalId,
}: {
  pack: any; shiftId: string; shiftNumber: number | null; saleId: string; ticketBarcode: string;
  currentTicketNumber: number; packStatus: string; ticketsSold?: number; salesAmount?: number; replayed?: boolean; terminalId?: string;
}) {
  const ticketPrice = Number(pack.ticketPrice ?? pack.game.price ?? 0);
  const shiftSalesAmount = salesAmount ?? ticketPrice;
  const { profitAmount, stateCost } = calculateTicketSaleSplit(shiftSalesAmount);
  const nextTicketNumber = packStatus === "SOLD_OUT" || currentTicketNumber <= 0
    ? null
    : expectedPhysicalTicketByDirection(
        Number(pack.firstTicket ?? 1),
        Number(pack.ticketQuantity ?? pack.game.ticketsPerPack ?? currentTicketNumber),
        currentTicketNumber,
        pack.firstOrLastTicket,
      );
  return NextResponse.json({
    status: "found", id: pack.id, shiftId, shiftNumber, saleId, ticketBarcode,
    serialNumber: pack.serialNumber, gameNumber: pack.game.gameNumber, gameName: pack.game.name,
    packStatus, currentTicketNumber, nextTicketNumber, ticketQuantity: pack.ticketQuantity,
    ticketPrice: pack.ticketPrice, ticketsSold, salesAmount: shiftSalesAmount,
    profitAmount, stateCost, idempotentReplay: replayed,
    terminalId: terminalId ?? null,
    slot: pack.slot ? { slotNumber: pack.slot.slotNumber } : null,
    game: { name: pack.game.name, gameNumber: pack.game.gameNumber },
  });
}

async function findCommittedSale(storeId: string, userId: string, clientRequestId: string) {
  const rows = await prisma!.$queryRawUnsafe(`
    SELECT e.id, e.shift_id AS "shiftId", s.shift_number AS "shiftNumber",
      e.login_session_id AS "loginSessionId",
      e.pack_id AS "packId", e.ticket_barcode AS "ticketBarcode"
    FROM live_scan_events e
    JOIN shifts s ON s.id = e.shift_id
    WHERE e.store_id = $1 AND e.scanned_by_id = $2 AND e.client_request_id = $3
    LIMIT 1
  `, storeId, userId, clientRequestId) as Array<{
    id: string; shiftId: string; shiftNumber: number | null; loginSessionId: string | null; packId: string; ticketBarcode: string;
  }>;
  return rows[0] ?? null;
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (isReadOnly(session)) return NextResponse.json({ error: "Auditor accounts are read-only." }, { status: 403 });

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { serialNumber, liveScan, terminalId: rawTerminalId, deviceKey, expectedStoreId, shiftId: requestedShiftId } = body;
  const rawClientRequestId = body?.clientRequestId;
  const requestedLoginSessionId = typeof body?.loginSessionId === "string" ? body.loginSessionId.trim() : "";
  if (rawClientRequestId !== undefined && (typeof rawClientRequestId !== "string" || rawClientRequestId.length < 1 || rawClientRequestId.length > 120 || !/^[\w-]+$/.test(rawClientRequestId))) {
    return NextResponse.json({ error: "The scan request ID is invalid." }, { status: 400 });
  }
  const clientRequestId = typeof rawClientRequestId === "string" ? rawClientRequestId : null;
  if (expectedStoreId !== undefined && expectedStoreId !== session.storeId) {
    return NextResponse.json({ error: "The signed-in store changed. Return to the original store to sync these scans.", code: "STORE_CHANGED" }, { status: 409 });
  }
  if (!serialNumber || typeof serialNumber !== "string") {
    return NextResponse.json(
      { error: "serialNumber is required" },
      { status: 400 }
    );
  }

  try {
    const staffBound = session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD";
    const terminalId = staffBound ? session.terminalId ?? "" : normalizeTerminalId(rawTerminalId) ?? "T1";
    if (!terminalId || (staffBound && rawTerminalId !== undefined && normalizeTerminalId(rawTerminalId) !== terminalId)) {
      return NextResponse.json({ error: "Your signed-in terminal assignment is missing or changed. Sign in again and choose the correct terminal shift." }, { status: 409 });
    }
    if (liveScan === true && (!session.loginSessionId || !requestedLoginSessionId)) {
      return NextResponse.json({ error: "Your login session has expired. Sign out and sign in again before tracking tickets." }, { status: 409 });
    }
    const deviceAuthorization = await authorizeRegisteredDevice(session.storeId, terminalId, deviceKey);
    if (!deviceAuthorization.authorized) {
      return NextResponse.json({ error: deviceAuthorization.reason }, { status: 403 });
    }
    const normalizedSerial = serialNumber.replace(/\D/g, "");
    if (!isValidPackBarcode(normalizedSerial)) {
      return NextResponse.json(
        {
          error:
            "Scan the complete 14-digit ticket barcode: 11 pack digits plus 3 ticket digits.",
        },
        { status: 400 }
      );
    }

    if (liveScan === true && resolveScannedTicketNumber(normalizedSerial) === null) {
      return NextResponse.json(
        { error: "Ticket number 000 is invalid. Scan a complete barcode with a ticket number from 001 through 999.", code: "INVALID_TICKET_NUMBER", noSale: true },
        { status: 400 },
      );
    }

    try {
      const registeredRows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS count FROM store_devices WHERE store_id = $1`,
        session.storeId
      ) as Array<{ count: number }>;
      if (Number(registeredRows[0]?.count ?? 0) > 0) {
        const activeRows = await prisma.$queryRawUnsafe(
          `SELECT id FROM store_devices WHERE store_id = $1 AND terminal_id = $2 AND active = TRUE LIMIT 1`,
          session.storeId,
          terminalId
        ) as Array<{ id: string }>;
        if (activeRows.length === 0) {
          return NextResponse.json(
            { error: `Terminal ${terminalId} is not registered or is inactive for this store.` },
            { status: 403 }
          );
        }
      }
    } catch {
      // Legacy stores may not have initialized the device registry yet.
    }

    if (liveScan === true && clientRequestId) {
      const replayShiftId = staffBound
        ? session.shiftId
        : typeof requestedShiftId === "string" ? requestedShiftId.trim() : null;
      if (staffBound && !replayShiftId) {
        return NextResponse.json({ error: "Your shift assignment is missing. Sign in again and select an open shift." }, { status: 409 });
      }
      const committed = await findCommittedSale(session.storeId, session.userId, clientRequestId);
      if (committed) {
        if (committed.ticketBarcode !== normalizedSerial || !replayShiftId || committed.shiftId !== replayShiftId || committed.loginSessionId !== requestedLoginSessionId) {
          return NextResponse.json({ error: "This queued scan request was already used for a different shift or ticket." }, { status: 409 });
        }
        const committedPack = await prisma.pack.findFirst({
          where: { id: committed.packId, storeId: session.storeId },
          include: { game: true, slot: true },
        });
        if (!committedPack) return NextResponse.json({ error: "The ticket tracking record exists, but its pack is no longer available." }, { status: 409 });
        const committedLine = await prisma.shiftLine.findUnique({
          where: { shiftId_packId: { shiftId: committed.shiftId, packId: committed.packId } },
        });
        return saleResponse({
          pack: committedPack, shiftId: committed.shiftId, shiftNumber: committed.shiftNumber,
          saleId: committed.id, ticketBarcode: committed.ticketBarcode,
          currentTicketNumber: Number(committedPack.currentTicketNumber ?? 0),
          packStatus: committedPack.status, ticketsSold: Number(committedLine?.ticketsSold ?? 1),
          salesAmount: committedLine?.salesAmount == null ? undefined : Number(committedLine.salesAmount), replayed: true, terminalId,
        });
      }
    }

    // Check if pack already exists by exact serial first
    let existingPack = await prisma.pack.findFirst({
      where: { storeId: session.storeId, serialNumber: { in: [serialNumber, normalizedSerial] } },
      include: {
        game: true,
        slot: true,
      },
    });

    // Live scan fallback: a scanned ticket barcode may differ by ticket number.
    // Match active display pack by Game(4)+Pack(7) prefix when exact serial misses.
    if (!existingPack && liveScan === true) {
      if (normalizedSerial.length >= 11) {
        const parsedGameNumber = normalizedSerial.substring(0, 4);
        const parsedPackNumber = normalizedSerial.substring(4, 11);
        const candidatePacks = await prisma.pack.findMany({
          where: {
            storeId: session.storeId,
            status: "ACTIVE",
            gameNumber: { in: [parsedGameNumber, parsedGameNumber.replace(/^0+/, "")] },
          },
          include: { game: true, slot: true },
          orderBy: { activatedAt: "desc" },
        });
        existingPack = candidatePacks.find((pack: typeof candidatePacks[number]) =>
          String(pack.packNumber ?? "").replace(/\D/g, "") === parsedPackNumber
        ) ?? null;
      }
    }

    if (existingPack) {
      if (liveScan === true) {
        const scannedTicketNumber = resolveScannedTicketNumber(normalizedSerial);
        if (existingPack.status !== "ACTIVE") {
          return NextResponse.json(
            { error: "Only ACTIVE packs can be scanned in live mode." },
            { status: 400 }
          );
        }
        if (!existingPack.slot) {
          return NextResponse.json(
            { error: "Pack must be assigned to a display slot before live scan." },
            { status: 400 }
          );
        }

        let selectedShiftId = typeof requestedShiftId === "string" && requestedShiftId.trim()
          ? requestedShiftId.trim()
          : null;
        if (staffBound) {
          if (!session.shiftId || (selectedShiftId && selectedShiftId !== session.shiftId)) {
            return NextResponse.json({ error: "Your shift assignment is missing or has changed. Sign in again and select an open shift." }, { status: 409 });
          }
          selectedShiftId = session.shiftId;
        }
        const openShifts: Array<{ id: string; shiftNumber: number | null; terminalId: string | null }> = await prisma.shift.findMany({
          where: { storeId: session.storeId, status: "OPEN", shiftNumber: { in: [1, 2] }, terminalId },
          select: { id: true, shiftNumber: true, terminalId: true },
          orderBy: [{ shiftNumber: "asc" }, { id: "asc" }],
        });
        if (!selectedShiftId && openShifts.length === 1) selectedShiftId = openShifts[0].id;
        if (!selectedShiftId && openShifts.length > 1) {
          return NextResponse.json({ error: "Select the numbered shift for ticket tracking." }, { status: 409 });
        }
        const selectedShift = openShifts.find((item) => item.id === selectedShiftId);
        const openShift = selectedShift
          ? await prisma.shift.findFirst({ where: { id: selectedShift.id, storeId: session.storeId, status: "OPEN", terminalId } })
          : null;

        if (!openShift) {
          return NextResponse.json(
            { error: `No open shift found for terminal ${terminalId}.` },
            { status: 400 }
          );
        }

        if (!session.loginSessionId || requestedLoginSessionId !== session.loginSessionId) {
          throw new LiveScanError("Sign out and sign in again to start an attributed ticket tracking session.", 409, "LOGIN_SESSION_REQUIRED");
        }
        const loginSessionRows = await prisma.$queryRawUnsafe(`
          SELECT id, shift_id AS "shiftId", terminal_id AS "terminalId"
          FROM login_sessions WHERE id = $1 AND store_id = $2 AND user_id = $3 LIMIT 1
        `, requestedLoginSessionId, session.storeId, session.userId) as Array<{ id: string; shiftId: string | null; terminalId: string | null }>;
        const attributedSession = loginSessionRows[0];
        if (!attributedSession) throw new LiveScanError("This scan does not belong to a valid login session for your account.", 403, "LOGIN_SESSION_MISMATCH");
        if (staffBound && (attributedSession.shiftId !== openShift.id || attributedSession.terminalId !== terminalId)) {
          throw new LiveScanError("This scan does not match your signed-in terminal shift.", 403, "SHIFT_SESSION_MISMATCH");
        }

        const scanEventId = `lse_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const saleResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const lockedShifts = await tx.$queryRawUnsafe<Array<{ id: string; shiftNumber: number | null; terminalId: string }>>(`
            SELECT id, shift_number AS "shiftNumber", "terminalId" FROM shifts
            WHERE id = $1 AND "storeId" = $2 AND status = 'OPEN' FOR UPDATE
          `, openShift.id, session.storeId);
          if (lockedShifts.length !== 1) throw new Error("CONCURRENT_TICKET_SCAN");
          const lockedPacks = await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT id FROM packs WHERE id = $1 AND "storeId" = $2 FOR UPDATE`,
            existingPack.id, session.storeId,
          );
          if (lockedPacks.length !== 1) throw new LiveScanError("Pack is no longer available in this store.", 409);

          if (clientRequestId) {
            const prior = await tx.$queryRawUnsafe<Array<{
              id: string; shiftId: string; shiftNumber: number | null; loginSessionId: string | null; packId: string; ticketBarcode: string;
            }>>(`
              SELECT id, shift_id AS "shiftId", login_session_id AS "loginSessionId", pack_id AS "packId", ticket_barcode AS "ticketBarcode",
                $1::int AS "shiftNumber"
              FROM live_scan_events WHERE store_id = $2 AND scanned_by_id = $3 AND client_request_id = $4 LIMIT 1
            `, lockedShifts[0].shiftNumber, session.storeId, session.userId, clientRequestId);
            if (prior.length > 0) {
              const event = prior[0];
              if (event.shiftId !== openShift.id || event.ticketBarcode !== normalizedSerial || event.loginSessionId !== requestedLoginSessionId) {
                throw new LiveScanError("This queued scan request was already used for a different shift or ticket.", 409);
              }
              const priorPack = await tx.pack.findFirst({
                where: { id: event.packId, storeId: session.storeId }, include: { game: true, slot: true },
              });
              if (!priorPack) throw new LiveScanError("The recorded sale exists, but its pack is no longer available.", 409);
              const priorLine = await tx.shiftLine.findUnique({
                where: { shiftId_packId: { shiftId: openShift.id, packId: event.packId } },
              });
              return { kind: "replay" as const, event, pack: priorPack, line: priorLine, shiftNumber: lockedShifts[0].shiftNumber };
            }
          }

          const duplicateRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(`
            SELECT id FROM live_scan_events
            WHERE store_id = $1 AND shift_id = $2 AND ticket_barcode = $3 LIMIT 1
          `, session.storeId, openShift.id, normalizedSerial);
          if (duplicateRows.length > 0) {
            throw new LiveScanError("This scratch card was already scanned in this shift.", 409, "DUPLICATE_SCAN");
          }

          const pack = await tx.pack.findFirst({
            where: { id: existingPack.id, storeId: session.storeId, status: "ACTIVE", slot: { isNot: null } },
            include: { game: true, slot: true },
          });
          if (!pack) throw new LiveScanError("Only active packs assigned to a display can be scanned in live mode.", 409);

          const audit = await tx.inventoryAudit.findUnique({
            where: { shiftId: openShift.id },
            select: { status: true, lines: { select: { packId: true, beginningPhysicalTicket: true } } },
          });
          const activeDisplayPacks: Array<{ id: string }> = await tx.pack.findMany({
            where: { storeId: session.storeId, status: "ACTIVE", slot: { isNot: null } },
            select: { id: true },
          });
          const auditLines = audit?.lines ?? [];
          const openingAuditComplete = audit?.status === "OPEN" &&
            activeDisplayPacks.every((active) => auditLines.some((line: { packId: string; beginningPhysicalTicket: number | null }) =>
              line.packId === active.id && line.beginningPhysicalTicket !== null
            ));
          if (!openingAuditComplete) {
            throw new LiveScanError(
              audit?.status === "COMPLETED"
                ? "The Closing Audit is complete. No more tickets can be tracked on this shift."
                : "Complete the Opening Audit for every active display pack before tracking tickets.",
              409,
              "BEGINNING_AUDIT_REQUIRED",
            );
          }

          const auditLine = auditLines.find((line: { packId: string; beginningPhysicalTicket: number | null }) =>
            line.packId === pack.id && line.beginningPhysicalTicket !== null
          );
          const line = await tx.shiftLine.findUnique({ where: { shiftId_packId: { shiftId: openShift.id, packId: pack.id } } });
          if (!auditLine || !line) {
            throw new LiveScanError("Record this pack in the Opening Audit before tracking tickets.", 409, "BEGINNING_AUDIT_REQUIRED");
          }

          const beginning = getSafeCurrentTicket({
            currentTicketNumber: Number(line.beginningTicket ?? 0),
            firstTicket: pack.firstTicket ?? null,
            ticketQuantity: pack.ticketQuantity ?? null,
          });
          const normalizedTicketState = getValidTicketState({
            currentTicketNumber: pack.currentTicketNumber ?? null,
            firstTicket: pack.firstTicket ?? null,
            ticketQuantity: pack.ticketQuantity ?? null,
          });
          const clampedCurrentTicket = getSafeCurrentTicket({
            currentTicketNumber: pack.currentTicketNumber ?? null,
            firstTicket: pack.firstTicket ?? null,
            ticketQuantity: pack.ticketQuantity ?? null,
          });
          const currentTicket = clampedCurrentTicket > 0
            ? clampedCurrentTicket
            : normalizedTicketState.currentTicketNumber > 0
              ? normalizedTicketState.currentTicketNumber
              : beginning;
          const expectedPhysical = expectedPhysicalTicketByDirection(
            normalizedTicketState.firstTicket || 1,
            Number(pack.ticketQuantity ?? pack.game.ticketsPerPack ?? beginning),
            Number(currentTicket),
            pack.firstOrLastTicket,
          );
          if (currentTicket <= 0) throw new LiveScanError("Pack has no tickets remaining.", 400);

          if (scannedTicketNumber !== null && expectedPhysical !== null && scannedTicketNumber !== expectedPhysical) {
            return { kind: "mismatch" as const, pack, expectedPhysical, scannedTicketNumber, shiftNumber: lockedShifts[0].shiftNumber };
          }

          let sequenceLockResolved = false;
          if (pack.sequenceLocked) {
            if (!canSelfResolveSequenceLock(pack.sequenceLocked, pack.sequenceLockExpectedTicket, scannedTicketNumber)) {
              throw new LiveScanError("This ticket cannot be tracked until the existing pack review is resolved.", 409, "SEQUENCE_LOCKED");
            }
            await tx.pack.update({ where: { id: pack.id }, data: {
              sequenceLocked: false, sequenceLockExpectedTicket: null, sequenceLockScannedTicket: null,
              sequenceLockBarcode: null, sequenceLockedAt: null, sequenceLockedById: null,
            } });
            pack.sequenceLocked = false;
            sequenceLockResolved = true;
          }

          const endingTicket = Math.max(currentTicket - 1, 0);
          const ticketPrice = Number(pack.ticketPrice ?? pack.game.price ?? 0);
          const soldOut = endingTicket === 0;
          const updateResult = await tx.pack.updateMany({
            where: { id: pack.id, storeId: session.storeId, status: "ACTIVE", currentTicketNumber: pack.currentTicketNumber },
            data: { currentTicketNumber: endingTicket, status: soldOut ? "SOLD_OUT" : "ACTIVE" },
          });
          if (updateResult.count !== 1) throw new Error("CONCURRENT_TICKET_SCAN");

          await tx.$executeRawUnsafe(`
            INSERT INTO live_scan_events (id, store_id, shift_id, pack_id, ticket_barcode, client_request_id, scanned_by_id, terminal_id, login_session_id, ticket_price, display_number)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, scanEventId, session.storeId, openShift.id, pack.id, normalizedSerial, clientRequestId, session.userId, terminalId, requestedLoginSessionId, Number(pack.ticketPrice ?? pack.game.price ?? 0), pack.slot?.slotNumber ?? null);
          const shiftCounts = await tx.$queryRawUnsafe<Array<{ ticketsSold: number | bigint; ticketValue: number | string }>>(
            `SELECT COUNT(*)::int AS "ticketsSold", COALESCE(SUM(ticket_price), 0)::numeric AS "ticketValue" FROM live_scan_events WHERE store_id = $1 AND shift_id = $2 AND pack_id = $3`,
            session.storeId, openShift.id, pack.id,
          );
          const shiftTicketsSold = Number(shiftCounts[0]?.ticketsSold ?? 0);
          const shiftSalesAmount = Number(shiftCounts[0]?.ticketValue ?? 0);
          const shiftEndingTicket = Math.max(Number(line.beginningTicket) - shiftTicketsSold, 0);
          await tx.shiftLine.update({
            where: { id: line.id },
            data: { endingTicket: shiftEndingTicket, ticketsSold: shiftTicketsSold, salesAmount: shiftSalesAmount },
          });
          await tx.$executeRawUnsafe(`
            INSERT INTO shift_participants (shift_id, user_id) VALUES ($1, $2)
            ON CONFLICT (shift_id, user_id) DO UPDATE SET last_seen_at = NOW()
          `, openShift.id, session.userId);

          if (soldOut) {
            await tx.displaySlot.updateMany({
              where: { storeId: session.storeId, packId: pack.id },
              data: { packId: null },
            });
            await tx.scanLogEntry.create({
              data: {
                storeId: session.storeId, action: "SOLD_OUT", performedById: session.userId,
                packId: pack.id, detail: `Pack #${pack.packNumber ?? "not recorded"} · Game #${pack.game.gameNumber} reached its final ticket during tracking.`,
              },
            });
          }
          return {
            kind: "sold" as const, pack, shiftNumber: lockedShifts[0].shiftNumber, scanEventId,
            endingTicket, ticketPrice, soldOut, sequenceLockResolved,
            ticketsSold: shiftTicketsSold, salesAmount: shiftSalesAmount,
          };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        if (saleResult.kind === "replay") {
          return saleResponse({
            pack: saleResult.pack, shiftId: saleResult.event.shiftId, shiftNumber: saleResult.shiftNumber,
            saleId: saleResult.event.id, ticketBarcode: saleResult.event.ticketBarcode,
            currentTicketNumber: Number(saleResult.pack.currentTicketNumber ?? 0),
            packStatus: saleResult.pack.status, ticketsSold: Number(saleResult.line?.ticketsSold ?? 1),
            salesAmount: saleResult.line?.salesAmount == null ? undefined : Number(saleResult.line.salesAmount), replayed: true, terminalId,
          });
        }
        if (saleResult.kind === "mismatch") {
          const eventKey = clientRequestId
            ? `TICKET_EXCEPTION:${clientRequestId}:${saleResult.shiftNumber ?? "—"}:${saleResult.pack.id}:${normalizedSerial}`
            : `TICKET_EXCEPTION:${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          await createInventoryNotification({
            storeId: session.storeId,
            type: "TICKET_EXCEPTION",
            entityId: saleResult.pack.id,
            eventKey,
            packId: saleResult.pack.id,
            title: "Out-of-sequence ticket scan",
            detail: `${session.name} scanned ticket ${saleResult.scannedTicketNumber} for Pack #${saleResult.pack.packNumber ?? "not recorded"} · Game #${saleResult.pack.game.gameNumber} at Display ${saleResult.pack.slot?.slotNumber ?? "—"}, Shift ${saleResult.shiftNumber ?? "—"}, Terminal ${terminalId}. Expected ticket ${saleResult.expectedPhysical}. No ticket was tracked.`,
            severity: "HIGH",
          }).catch((error) => console.warn("Unable to persist ticket sequence exception alert", error));
          return NextResponse.json({
            code: "TICKET_SEQUENCE_MISMATCH",
            error: `Wrong ticket scanned in this shift. No ticket was tracked. The system expected ticket ${saleResult.expectedPhysical}; ticket ${saleResult.scannedTicketNumber} was scanned.`,
            expectedTicket: saleResult.expectedPhysical,
            scannedTicketNumber: saleResult.scannedTicketNumber,
            packId: saleResult.pack.id,
            noSale: true,
          }, { status: 409 });
        }

        if (saleResult.sequenceLockResolved) {
          await logInventoryActivity({
            storeId: session.storeId, action: "SEQUENCE_LOCK_SELF_RESOLVED", entityType: "PACK",
            entityId: saleResult.pack.id,
            detail: `Employee scanned expected ticket ${scannedTicketNumber} and cleared the sequence lock.`,
            performedById: session.userId, performedByName: session.name, terminalId,
          });
        }
        await logInventoryActivity({
          storeId: session.storeId, action: "LIVE_TICKET_SCAN", entityType: "PACK",
          entityId: saleResult.pack.id,
          detail: `Scanned ticket ${normalizedSerial} for pack ${saleResult.pack.serialNumber}.`,
          performedById: session.userId, performedByName: session.name, terminalId,
        });
        return saleResponse({
          pack: saleResult.pack, shiftId: openShift.id, shiftNumber: saleResult.shiftNumber,
          saleId: saleResult.scanEventId, ticketBarcode: normalizedSerial,
          currentTicketNumber: saleResult.endingTicket,
          packStatus: saleResult.soldOut ? "SOLD_OUT" : "ACTIVE",
          ticketsSold: saleResult.ticketsSold, salesAmount: saleResult.salesAmount, terminalId,
        });
      }

      return NextResponse.json({
        status: "found",
        id: existingPack.id,
        serialNumber: existingPack.serialNumber,
        gameNumber: existingPack.game.gameNumber,
        gameName: existingPack.game.name,
        packStatus: existingPack.status,
        currentTicketNumber: existingPack.currentTicketNumber,
        ticketQuantity: existingPack.ticketQuantity,
        ticketPrice: existingPack.ticketPrice,
        slot: existingPack.slot ? { slotNumber: existingPack.slot.slotNumber } : null,
        game: {
          name: existingPack.game.name,
          gameNumber: existingPack.game.gameNumber,
        },
      });
    }

    if (liveScan === true) {
      await createInventoryNotification({
        storeId: session.storeId,
        type: "WRONG_PACK_OR_GAME",
        entityId: normalizedSerial,
        title: "Wrong pack or game scan",
        detail: "A scanned ticket could not be matched to an active display pack for this store. No ticket was tracked.",
        severity: "HIGH",
      });
      return NextResponse.json(
        { error: "Ticket scan rejected: no active display pack matches this barcode." },
        { status: 404 }
      );
    }

    // For receiving mode: check if it's a duplicate
    const isDuplicate = await prisma.pack.findFirst({
      where: { storeId: session.storeId, serialNumber },
      select: { id: true, packNumber: true, game: { select: { gameNumber: true } } },
    });

    if (isDuplicate) {
      await createInventoryNotification({
        storeId: session.storeId,
        type: "DUPLICATE_PACK",
        entityId: isDuplicate.id,
        packId: isDuplicate.id,
        title: "Duplicate pack received",
        detail: `Pack #${isDuplicate.packNumber ?? "not recorded"} · Game #${isDuplicate.game.gameNumber} was submitted for receiving again after it already existed in LottoOps.`,
        severity: "HIGH",
      });
      return NextResponse.json({ status: "duplicate" });
    }

    // Texas Lottery pack serials lead with the state-assigned game number
    // (e.g. "2739-0334219" -> game 2739). Only match active games — you
    // can't receive new inventory of a deactivated game.
    const match = serialNumber.match(/^(\d{3,4})/);
    if (!match) {
      return NextResponse.json({ status: "unrecognized" });
    }

    const game = await prisma.game.findFirst({
      where: { storeId: session.storeId, gameNumber: match[1], active: true },
    });

    if (!game) {
      return NextResponse.json({ status: "unrecognized" });
    }

    return NextResponse.json({
      status: "ok",
      game: { ...game, price: Number(game.price) },
    });
  } catch (err) {
    if (err instanceof LiveScanError) {
      return NextResponse.json({ error: err.message, ...(err.code ? { code: err.code } : {}) }, { status: err.status });
    }
    console.error("[POST /api/packs/check-serial]", err);
    if (err instanceof Error && err.message === "CONCURRENT_TICKET_SCAN") {
      return NextResponse.json(
        { error: "This pack was advanced by another terminal. Scan the next expected ticket." },
        { status: 409 }
      );
    }
    const databaseError = err && typeof err === "object" ? err as { code?: string; meta?: { code?: string }; cause?: { code?: string } } : null;
    const errorCode = databaseError?.code;
    const isUniqueViolation = errorCode === "23505" || errorCode === "P2002" ||
      (errorCode === "P2010" && (databaseError?.meta?.code === "23505" || databaseError?.cause?.code === "23505"));
    if (isUniqueViolation) {
      if (clientRequestId) {
        const committed = await findCommittedSale(session.storeId, session.userId, clientRequestId).catch(() => null);
        const retryShiftId = session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD"
          ? session.shiftId
          : typeof requestedShiftId === "string" ? requestedShiftId.trim() : null;
        const retryBarcode = typeof serialNumber === "string" ? serialNumber.replace(/\D/g, "") : "";
        if (committed && retryShiftId && committed.shiftId === retryShiftId && committed.ticketBarcode === retryBarcode) {
          const pack = await prisma.pack.findFirst({
            where: { id: committed.packId, storeId: session.storeId },
            include: { game: true, slot: true },
          });
          const line = await prisma.shiftLine.findUnique({
            where: { shiftId_packId: { shiftId: committed.shiftId, packId: committed.packId } },
          });
          if (pack) return saleResponse({
            pack, shiftId: committed.shiftId, shiftNumber: committed.shiftNumber,
            saleId: committed.id, ticketBarcode: committed.ticketBarcode,
            currentTicketNumber: Number(pack.currentTicketNumber ?? 0), packStatus: pack.status,
            ticketsSold: Number(line?.ticketsSold ?? 1),
            salesAmount: line?.salesAmount == null ? undefined : Number(line.salesAmount), replayed: true,
          });
        }
      }
      return NextResponse.json(
        { error: "This scratch card was already scanned in this shift." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to check serial number" },
      { status: 500 }
    );
  }
}
