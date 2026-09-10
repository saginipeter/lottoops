import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { recordShiftParticipant } from "@/lib/shift-participants";
import { logInventoryActivity } from "@/lib/activity-log";
import { canSelfResolveSequenceLock } from "@/lib/control-validation";
import { createInventoryNotification } from "@/lib/inventory-notifications";
import { isReadOnly } from "@/lib/permissions";

function resolveSellableTicket(pack: {
  currentTicketNumber: number | null;
  firstTicket: number | null;
  ticketQuantity: number | null;
}) {
  const candidates = [pack.currentTicketNumber, pack.firstTicket, pack.ticketQuantity]
    .map((value) => Number(value ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  return candidates.length > 0 ? candidates[0] : null;
}

function resolveScannedTicketNumber(normalizedSerial: string) {
  if (normalizedSerial.length <= 11) return null;

  const ticketSuffix = normalizedSerial.substring(11);
  if (ticketSuffix.length > 3) return null;

  const ticketNumber = Number(ticketSuffix);
  return Number.isInteger(ticketNumber) && ticketNumber > 0
    ? ticketNumber
    : null;
}

async function ensureShiftTerminalSchema() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS "terminalId" TEXT
  `);
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

  const { serialNumber, liveScan, terminalId: rawTerminalId } = await req.json();
  if (!serialNumber || typeof serialNumber !== "string") {
    return NextResponse.json(
      { error: "serialNumber is required" },
      { status: 400 }
    );
  }

  try {
    const terminalId =
      typeof rawTerminalId === "string" && rawTerminalId.trim()
        ? rawTerminalId.trim().toUpperCase()
        : "T1";
    const normalizedSerial = serialNumber.replace(/\D/g, "");

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

    // Check if pack already exists by exact serial first
    let existingPack = await prisma.pack.findFirst({
      where: { storeId: session.storeId, serialNumber },
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
        existingPack = await prisma.pack.findFirst({
          where: {
            storeId: session.storeId,
            status: "ACTIVE",
            gameNumber: parsedGameNumber,
            packNumber: parsedPackNumber,
            slot: { isNot: null },
          },
          include: {
            game: true,
            slot: true,
          },
          orderBy: {
            activatedAt: "desc",
          },
        });
      }
    }

    if (existingPack) {
      if (liveScan === true) {
        const scannedTicketNumber = resolveScannedTicketNumber(normalizedSerial);
        if (canSelfResolveSequenceLock(existingPack.sequenceLocked, existingPack.sequenceLockExpectedTicket, scannedTicketNumber)) {
          await prisma.pack.update({
            where: { id: existingPack.id },
            data: {
              sequenceLocked: false,
              sequenceLockExpectedTicket: null,
              sequenceLockScannedTicket: null,
              sequenceLockBarcode: null,
              sequenceLockedAt: null,
              sequenceLockedById: null,
            },
          });
          await logInventoryActivity({
            storeId: session.storeId,
            action: "SEQUENCE_LOCK_SELF_RESOLVED",
            entityType: "PACK",
            entityId: existingPack.id,
            detail: `Employee scanned expected ticket ${scannedTicketNumber} and cleared the sequence lock.`,
            performedById: session.userId,
            performedByName: session.name,
            terminalId,
          });
          existingPack.sequenceLocked = false;
        }
        if (existingPack.sequenceLocked) {
          return NextResponse.json(
            {
              code: "SEQUENCE_LOCKED",
              error: "Pack is locked pending manager review.",
              expectedTicket: existingPack.sequenceLockExpectedTicket,
              scannedTicket: existingPack.sequenceLockScannedTicket,
            },
            { status: 409 }
          );
        }
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

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS live_scan_events (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
            shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
            pack_id TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
            ticket_barcode TEXT NOT NULL,
            scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(store_id, shift_id, ticket_barcode)
          )
        `);

        await ensureShiftTerminalSchema();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const openShiftRows = (await prisma.$queryRawUnsafe(
          `
          SELECT id
          FROM shifts
          WHERE "storeId" = $1
            AND status = 'OPEN'
          ORDER BY "openedAt" DESC
          LIMIT 1
          `,
          session.storeId
        )) as { id: string }[];
        const openShift = openShiftRows[0]
          ? await prisma.shift.findUnique({ where: { id: openShiftRows[0].id } })
          : null;

        if (!openShift) {
          return NextResponse.json(
            { error: `No open shift found for terminal ${terminalId}.` },
            { status: 400 }
          );
        }
        await recordShiftParticipant(openShift.id, session.userId);

        // Block duplicate ticket scans in the same open shift.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const duplicateRows = (await prisma.$queryRawUnsafe(
          `
          SELECT id
          FROM live_scan_events
          WHERE store_id = $1
            AND shift_id = $2
            AND ticket_barcode = $3
          LIMIT 1
          `,
          session.storeId,
          openShift.id,
          normalizedSerial
        )) as { id: string }[];

        if (duplicateRows.length > 0) {
          return NextResponse.json(
            { error: "This scratch card was already scanned in this shift." },
            { status: 409 }
          );
        }

        let line = await prisma.shiftLine.findFirst({
          where: {
            shiftId: openShift.id,
            packId: existingPack.id,
          },
          take: 1,
        });

        if (!line) {
          const beginningTicket = resolveSellableTicket(existingPack);
          if (beginningTicket === null) {
            return NextResponse.json(
              {
                error:
                  "Pack ticket state is invalid (current/first/quantity). Correct it before scanning.",
              },
              { status: 409 }
            );
          }

          if (!existingPack.slot) {
            return NextResponse.json(
              { error: "Pack must be assigned to a display slot before live scan." },
              { status: 400 }
            );
          }

          line = await prisma.shiftLine.create({
            data: {
              shiftId: openShift.id,
              packId: existingPack.id,
              slotNumber: existingPack.slot.slotNumber,
              beginningTicket,
            },
          });
        }

        const beginning = Number(line.beginningTicket ?? 0);
        const currentTicket = existingPack.currentTicketNumber ?? beginning;

        // Enforce one-scan-per-ticket and strict sequence from current ticket.
        if (scannedTicketNumber !== null && scannedTicketNumber !== currentTicket) {
            await prisma.pack.update({
              where: { id: existingPack.id },
              data: {
                sequenceLocked: true,
                sequenceLockExpectedTicket: currentTicket,
                sequenceLockScannedTicket: scannedTicketNumber,
                sequenceLockBarcode: normalizedSerial,
                sequenceLockedAt: new Date(),
                sequenceLockedById: session.userId,
              },
            });
            await createInventoryNotification({
              storeId: session.storeId,
              type: "EXPECTED_TICKET_MISMATCH",
              entityId: existingPack.id,
              title: "Expected ticket mismatch",
              detail: `Pack ${existingPack.serialNumber} expected ticket ${currentTicket}, but ticket ${scannedTicketNumber} was scanned.`,
              severity: "HIGH",
            });
            return NextResponse.json(
              {
                code: "SEQUENCE_LOCKED",
                error: `Out-of-sequence scan. Expected ticket ${currentTicket}, but scanned ticket ${scannedTicketNumber}. Pack locked pending manager review.`,
              },
              { status: 409 }
            );
        }

        if (currentTicket <= 0) {
          return NextResponse.json(
            { error: "Pack is already sold out." },
            { status: 400 }
          );
        }

        const endingTicket = Math.max(currentTicket - 1, 0);
        const ticketsSold = Math.max(beginning - endingTicket, 0);
        const salesAmount =
          ticketsSold * Number(existingPack.ticketPrice ?? existingPack.game.price ?? 0);
        const soldOut = endingTicket === 0;
        const scanEventId = `lse_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        await prisma.$transaction(async (tx) => {
          const updatedRows = await tx.$executeRawUnsafe(
            `
            UPDATE packs
            SET "currentTicketNumber" = $1, status = $2
            WHERE id = $3
              AND "currentTicketNumber" = $4
              AND status = 'ACTIVE'
            `,
            endingTicket,
            soldOut ? "SOLD_OUT" : "ACTIVE",
            existingPack.id,
            currentTicket
          );
          if (updatedRows !== 1) {
            throw new Error("CONCURRENT_TICKET_SCAN");
          }

          await tx.$executeRawUnsafe(
            `
            INSERT INTO live_scan_events (id, store_id, shift_id, pack_id, ticket_barcode)
            VALUES ($1, $2, $3, $4, $5)
            `,
            scanEventId,
            session.storeId,
            openShift.id,
            existingPack.id,
            normalizedSerial
          );
          await tx.shiftLine.update({
            where: { id: line.id },
            data: { endingTicket, ticketsSold, salesAmount },
          });

          if (soldOut) {
            await tx.displaySlot.updateMany({
              where: { packId: existingPack.id },
              data: { packId: null },
            });
            await tx.scanLogEntry.create({
              data: {
                storeId: session.storeId,
                action: "SOLD_OUT",
                performedById: session.userId,
                packId: existingPack.id,
                detail: `Pack ${existingPack.serialNumber} sold out during live scan.`,
              },
            });
          }
        });

        await logInventoryActivity({
          storeId: session.storeId,
          action: "LIVE_TICKET_SCAN",
          entityType: "PACK",
          entityId: existingPack.id,
          detail: `Scanned ticket ${normalizedSerial} for pack ${existingPack.serialNumber}.`,
          performedById: session.userId,
          performedByName: session.name,
          terminalId,
        });

        return NextResponse.json({
          status: "found",
          id: existingPack.id,
          serialNumber: existingPack.serialNumber,
          gameNumber: existingPack.game.gameNumber,
          gameName: existingPack.game.name,
          packStatus: soldOut ? "SOLD_OUT" : "ACTIVE",
          currentTicketNumber: endingTicket,
          ticketQuantity: existingPack.ticketQuantity,
          ticketPrice: existingPack.ticketPrice,
          ticketsSold,
          salesAmount,
          slot: existingPack.slot
            ? { slotNumber: existingPack.slot.slotNumber }
            : null,
          game: {
            name: existingPack.game.name,
            gameNumber: existingPack.game.gameNumber,
          },
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
        detail: `Live scan ${normalizedSerial} did not match an active display pack in this store.`,
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
      select: { id: true },
    });

    if (isDuplicate) {
      await createInventoryNotification({
        storeId: session.storeId,
        type: "DUPLICATE_PACK",
        entityId: isDuplicate.id,
        title: "Duplicate pack received",
        detail: `Pack ${serialNumber} was submitted for receiving again after it already existed in LottoOps.`,
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
    console.error("[POST /api/packs/check-serial]", err);
    if (err instanceof Error && err.message === "CONCURRENT_TICKET_SCAN") {
      return NextResponse.json(
        { error: "This pack was advanced by another terminal. Scan the next expected ticket." },
        { status: 409 }
      );
    }
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
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