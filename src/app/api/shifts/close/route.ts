import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role === "VIEWER") {
    return NextResponse.json(
      { error: "You don't have permission to close shifts." },
      { status: 403 }
    );
  }

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  try {
    const { shiftId, allowIncompleteClose, overrideReason } = await req.json();

    if (!shiftId) {
      return NextResponse.json(
        { error: "Shift ID is required." },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.findUnique({
      where: {
        id: shiftId,
      },
      include: {
        lines: {
          include: {
            pack: {
              include: {
                game: true,
              },
            },
          },
        },
      },
    });

    if (!shift) {
      return NextResponse.json(
        { error: "Shift not found." },
        { status: 404 }
      );
    }

    if (shift.storeId !== session.storeId) {
      return NextResponse.json(
        { error: "Access denied." },
        { status: 403 }
      );
    }

    if (shift.status === "CLOSED") {
      return NextResponse.json(
        { error: "Shift is already closed." },
        { status: 400 }
      );
    }

    const missingLines = shift.lines.filter(
      (line: { endingTicket: number | null }) => line.endingTicket === null
    );
    const shouldAllowIncomplete = allowIncompleteClose === true;

    if (missingLines.length > 0 && !shouldAllowIncomplete) {
      return NextResponse.json(
        {
          error: `${missingLines.length} shift line(s) are missing ending tickets.`,
          missingCount: missingLines.length,
        },
        { status: 400 }
      );
    }

    if (missingLines.length > 0 && shouldAllowIncomplete) {
      if (session.role !== "MANAGER") {
        return NextResponse.json(
          { error: "Only managers can override incomplete shift close." },
          { status: 403 }
        );
      }

      if (!overrideReason || String(overrideReason).trim().length < 5) {
        return NextResponse.json(
          { error: "Override reason is required (minimum 5 characters)." },
          { status: 400 }
        );
      }
    }

    let totalSales = 0;
    let totalTickets = 0;

    await prisma.$transaction(async (tx: any) => {

      for (const line of shift.lines) {

        const beginning = line.beginningTicket;
        const ending = line.endingTicket ?? beginning;

        const ticketsSold = Math.max(beginning - ending, 0);

        const sales =
          ticketsSold * Number(line.pack.game.price);

        totalTickets += ticketsSold;
        totalSales += sales;

        await tx.shiftLine.update({
          where: {
            id: line.id,
          },
          data: {
            endingTicket: ending,
            ticketsSold,
            salesAmount: sales,
          },
        });

        // SOLD OUT
        if (ending <= 0) {

          await tx.pack.update({
            where: {
              id: line.pack.id,
            },
            data: {
              status: "SOLD_OUT",
              currentTicketNumber: 0,
            },
          });

          await tx.displaySlot.updateMany({
            where: {
              packId: line.pack.id,
            },
            data: {
              packId: null,
            },
          });

        } else {

          // STILL ACTIVE
          await tx.pack.update({
            where: {
              id: line.pack.id,
            },
            data: {
              currentTicketNumber: ending,
            },
          });

        }
      }

      await tx.shift.update({
        where: {
          id: shift.id,
        },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedById: session.userId,
        },
      });

      await tx.scanLogEntry.create({
        data: {
          storeId: session.storeId,
          action: "SHIFT_CLOSE",
          performedById: session.userId,
          detail:
            missingLines.length > 0 && shouldAllowIncomplete
              ? `Shift closed with manager override (${missingLines.length} incomplete line(s)). Reason: ${String(overrideReason).trim()}`
              : "Shift closed successfully.",
        },
      });

    });

    return NextResponse.json({
      success: true,
      totalTickets,
      totalSales,
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        error: "Unable to close shift.",
      },
      {
        status: 500,
      }
    );

  }
}