import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { shiftId } = await req.json();

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

    let totalSales = 0;
    let totalTickets = 0;

    for (const line of shift.lines) {
      const beginning = line.beginningTicket;
      const ending = line.endingTicket ?? beginning;

      const sold = Math.max(beginning - ending, 0);

      const sales =
        sold * Number(line.pack.game.price);

      totalSales += sales;
      totalTickets += sold;

      await prisma.shiftLine.update({
        where: {
          id: line.id,
        },
        data: {
          ticketsSold: sold,
          salesAmount: sales,
        },
      });

      // Sold out
      if (ending <= 0) {
        await prisma.pack.update({
          where: {
            id: line.pack.id,
          },
          data: {
            status: "SOLD_OUT",
          },
        });

        await prisma.displaySlot.updateMany({
          where: {
            packId: line.pack.id,
          },
          data: {
            packId: null,
          },
        });
      }
    }

    await prisma.shift.update({
      where: {
        id: shift.id,
      },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      totalSales,
      totalTickets,
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