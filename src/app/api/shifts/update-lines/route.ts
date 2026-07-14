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

    for (const line of lines) {
      const endingTicket =
        line.endingTicket === null || line.endingTicket === undefined
          ? null
          : Number(line.endingTicket);

      if (endingTicket !== null && !Number.isFinite(endingTicket)) {
        return NextResponse.json(
          { error: "Invalid ending ticket value." },
          { status: 400 }
        );
      }

      if (endingTicket !== null && (endingTicket < 0 || endingTicket > Number(line.beginningTicket))) {
        return NextResponse.json(
          { error: "Ending ticket must be between 0 and beginning ticket." },
          { status: 400 }
        );
      }

      const lineRecord = await prisma.shiftLine.findUnique({
        where: { id: line.id },
        include: { shift: true },
      });

      if (!lineRecord || lineRecord.shift.storeId !== session.storeId) {
        return NextResponse.json(
          { error: "Invalid shift line access." },
          { status: 403 }
        );
      }
    }

    await prisma.$transaction(
      lines.map((line: any) => {
        const endingTicket =
          line.endingTicket === null || line.endingTicket === undefined
            ? null
            : Number(line.endingTicket);
        const sold = Math.max(
          Number(line.beginningTicket) - (endingTicket ?? Number(line.beginningTicket)),
          0
        );
        const sales = sold * Number(line.price);

        return prisma.shiftLine.update({
          where: {
            id: line.id,
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