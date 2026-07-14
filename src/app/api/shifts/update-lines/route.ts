// app/api/shifts/update-lines/route.ts

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
      { error: "You don't have permission to update shift lines." },
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
    const { lines } = await req.json();

    if (!Array.isArray(lines)) {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const lineIds = lines
      .map((line: { id?: string }) => line.id)
      .filter((id: string | undefined): id is string => Boolean(id));

    if (lineIds.length === 0) {
      return NextResponse.json({ error: "No shift lines provided." }, { status: 400 });
    }

    const lineRecords = await prisma.shiftLine.findMany({
      where: {
        id: {
          in: lineIds,
        },
      },
      include: {
        shift: true,
        pack: {
          include: {
            game: true,
          },
        },
      },
    });

    if (lineRecords.length !== lineIds.length) {
      return NextResponse.json({ error: "Some shift lines were not found." }, { status: 404 });
    }

    for (const lineRecord of lineRecords) {
      if (lineRecord.shift.storeId !== session.storeId) {
        return NextResponse.json(
          { error: "Invalid shift line access." },
          { status: 403 }
        );
      }
    }

    await prisma.$transaction(
      lineRecords.map((lineRecord) => {
        const beginning = Number(lineRecord.beginningTicket);
        const currentTicket =
          lineRecord.pack.currentTicketNumber === null ||
          lineRecord.pack.currentTicketNumber === undefined
            ? beginning
            : Number(lineRecord.pack.currentTicketNumber);
        const endingTicket = Math.min(Math.max(currentTicket, 0), beginning);
        const sold = Math.max(beginning - endingTicket, 0);
        const sales = sold * Number(lineRecord.pack.game.price);

        return prisma.shiftLine.update({
          where: {
            id: lineRecord.id,
          },
          data: {
            endingTicket,
            ticketsSold: sold,
            salesAmount: sales,
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Unable to update shift lines.",
      },
      {
        status: 500,
      }
    );
  }
}