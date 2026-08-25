import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

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
            AND COALESCE("terminalId", 'T1') = $2
          ORDER BY "openedAt" DESC
          LIMIT 1
          `,
          session.storeId,
          terminalId
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
        if (normalizedSerial.length >= 14) {
          const scannedTicketNumber = Number(normalizedSerial.substring(normalizedSerial.length - 3));
          if (Number.isFinite(scannedTicketNumber) && scannedTicketNumber !== currentTicket) {
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
            return NextResponse.json(
              {
                code: "SEQUENCE_LOCKED",
                error:
                  scannedTicketNumber > currentTicket
                    ? `Ticket ${scannedTicketNumber} was already scanned. Current sellable ticket is ${currentTicket}.`
                    : `Out-of-sequence scan. Current sellable ticket is ${currentTicket}.`,
              },
              { status: 409 }
            );
          }
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

        const txOps: any[] = [
          prisma.$executeRawUnsafe(
            `
            INSERT INTO live_scan_events (id, store_id, shift_id, pack_id, ticket_barcode)
            VALUES ($1, $2, $3, $4, $5)
            `,
            scanEventId,
            session.storeId,
            openShift.id,
            existingPack.id,
            normalizedSerial
          ),
          prisma.pack.update({
            where: { id: existingPack.id },
            data: {
              currentTicketNumber: endingTicket,
              ...(soldOut ? { status: "SOLD_OUT" } : {}),
            },
          }),
          prisma.shiftLine.update({
            where: { id: line.id },
            data: {
              endingTicket,
              ticketsSold,
              salesAmount,
            },
          }),
        ];

        if (soldOut) {
          txOps.push(
            prisma.displaySlot.updateMany({
              where: {
                packId: existingPack.id,
              },
              data: {
                packId: null,
              },
            }),
            prisma.scanLogEntry.create({
              data: {
                storeId: session.storeId,
                action: "SOLD_OUT",
                performedById: session.userId,
                packId: existingPack.id,
                detail: `Pack ${existingPack.serialNumber} sold out during live scan.`,
              },
            })
          );
        }

        await prisma.$transaction(txOps);

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

    // For receiving mode: check if it's a duplicate
    const isDuplicate = await prisma.pack.findFirst({
      where: { storeId: session.storeId, serialNumber },
      select: { id: true },
    });

    if (isDuplicate) {
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
    return NextResponse.json(
      { error: "Failed to check serial number" },
      { status: 500 }
    );
  }
}