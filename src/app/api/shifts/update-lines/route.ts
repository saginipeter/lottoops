// app/api/shifts/update-lines/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { lines } = await req.json();

    if (!Array.isArray(lines)) {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      lines.map((line: any) => {
        const sold = Math.max(
          line.beginningTicket - line.endingTicket,
          0
        );

        const sales = sold * Number(line.price);

        return prisma.shiftLine.update({
          where: {
            id: line.id,
          },
          data: {
            endingTicket: line.endingTicket,
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