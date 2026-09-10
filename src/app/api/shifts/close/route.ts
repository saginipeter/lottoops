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

  try {
    const { shiftId } = await req.json();

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

    const audit = await prisma.inventoryAudit.findUnique({
      where: { shiftId: shift.id },
      select: { id: true, status: true },
    });
    if (!audit || audit.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Complete the beginning and ending physical audit before closing this shift." },
        { status: 409 }
      );
    }

    let totalSales = 0;
    let totalTickets = 0;
    const txOps: any[] = [];

    for (const line of shift.lines) {
      const beginning = line.beginningTicket;
      const currentTicket =
        line.pack.currentTicketNumber === null || line.pack.currentTicketNumber === undefined
          ? beginning
          : Number(line.pack.currentTicketNumber);
      if (!Number.isInteger(currentTicket) || currentTicket < 0 || currentTicket > beginning) {
        return NextResponse.json(
          { error: `Invalid ending ticket for pack ${line.pack.serialNumber}. Expected a value from 0 through ${beginning}.` },
          { status: 409 }
        );
      }
      const ending = currentTicket;
      const ticketsSold = Math.max(beginning - ending, 0);
      const sales = ticketsSold * Number(line.pack.ticketPrice ?? line.pack.game.price ?? 0);

      totalTickets += ticketsSold;
      totalSales += sales;

      txOps.push(
        prisma.shiftLine.update({
          where: { id: line.id },
          data: {
            endingTicket: ending,
            ticketsSold,
            salesAmount: sales,
          },
        })
      );

      if (ending <= 0) {
        txOps.push(
          prisma.pack.update({
            where: { id: line.pack.id },
            data: {
              status: "SOLD_OUT",
              currentTicketNumber: 0,
            },
          }),
          prisma.displaySlot.updateMany({
            where: { packId: line.pack.id },
            data: { packId: null },
          })
        );
      } else {
        txOps.push(
          prisma.pack.update({
            where: { id: line.pack.id },
            data: {
              currentTicketNumber: ending,
            },
          })
        );
      }
    }

    txOps.push(
      prisma.shift.update({
        where: { id: shift.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedById: session.userId,
        },
      }),
      prisma.scanLogEntry.create({
        data: {
          storeId: session.storeId,
          action: "SHIFT_CLOSE",
          performedById: session.userId,
          detail: "Shift closed successfully.",
        },
      })
    );

    await prisma.$transaction(txOps);

    return NextResponse.json({
      success: true,
      totalTickets,
      totalSales,
    });

  } catch (error) {

    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: `Unable to close shift. ${message}`,
      },
      {
        status: 500,
      }
    );

  }
}