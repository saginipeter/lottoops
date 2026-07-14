import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
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

    if (shift.status === "CLOSED") {
      return NextResponse.json(
        { error: "Shift is already closed." },
        { status: 400 }
      );
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

          // Replace with logged in user later
          // closedById: session.userId,
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