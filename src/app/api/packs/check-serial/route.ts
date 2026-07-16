import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

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

  const { serialNumber, liveScan } = await req.json();
  if (!serialNumber || typeof serialNumber !== "string") {
    return NextResponse.json(
      { error: "serialNumber is required" },
      { status: 400 }
    );
  }

  try {
    // Check if pack already exists (live scan mode)
    const existingPack = await prisma.pack.findFirst({
      where: { storeId: session.storeId, serialNumber },
      include: {
        game: true,
        slot: true,
      },
    });

    if (existingPack) {
      if (liveScan === true) {
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

        const openShift = await prisma.shift.findFirst({
          where: {
            storeId: session.storeId,
            status: "OPEN",
          },
          include: {
            lines: {
              where: {
                packId: existingPack.id,
              },
              take: 1,
            },
          },
          orderBy: {
            openedAt: "desc",
          },
        });

        if (!openShift || openShift.lines.length === 0) {
          return NextResponse.json(
            { error: "No open shift line found for this pack." },
            { status: 400 }
          );
        }

        const line = openShift.lines[0];
        const beginning = Number(line.beginningTicket ?? 0);
        const currentTicket = existingPack.currentTicketNumber ?? beginning;

        if (currentTicket <= 0) {
          return NextResponse.json(
            { error: "Pack is already sold out." },
            { status: 400 }
          );
        }

        const endingTicket = Math.max(currentTicket - 1, 0);
        const ticketsSold = Math.max(beginning - endingTicket, 0);
        const salesAmount = ticketsSold * Number(existingPack.game.price);
        const soldOut = endingTicket === 0;

        const txOps: any[] = [
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