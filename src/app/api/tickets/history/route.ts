import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

interface HistoryLog {
  id: string;
  action: string;
  detail: string;
  timestamp: Date;
  performedBy: { name: string };
}

export async function GET(request: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("ticket")?.trim() ?? "";
  const normalized = query.replace(/\D/g, "");
  if (!normalized) {
    return NextResponse.json(
      { error: "Enter a ticket number to search." },
      { status: 400 }
    );
  }

  if (!prisma) {
    return NextResponse.json({ error: "Database not connected" }, { status: 503 });
  }

  try {
    const prefix = normalized.length >= 11 ? normalized.slice(0, 11) : "";
    const pack = await prisma.pack.findFirst({
      where: {
        storeId: session.storeId,
        OR: [
          { serialNumber: query },
          { serialNumber: normalized },
          ...(prefix
            ? [{ gameNumber: prefix.slice(0, 4), packNumber: prefix.slice(4) }]
            : []),
        ],
      },
      include: {
        game: true,
        slot: true,
        scanLogs: {
          include: { performedBy: { select: { name: true } } },
          orderBy: { timestamp: "asc" },
          take: 100,
        },
      },
    });

    if (!pack) {
      return NextResponse.json({ found: false });
    }

    const lastLog = pack.scanLogs[pack.scanLogs.length - 1] ?? null;
    return NextResponse.json({
      found: true,
      pack: {
        id: pack.id,
        serialNumber: pack.serialNumber,
        gameNumber: pack.game.gameNumber,
        gameName: pack.game.name,
        status: pack.status,
        slotNumber: pack.slot?.slotNumber ?? null,
        currentTicketNumber: pack.currentTicketNumber,
        ticketQuantity: pack.ticketQuantity,
        ticketPrice: pack.ticketPrice ? Number(pack.ticketPrice) : Number(pack.game.price),
        receivedAt: pack.receivedAt,
        activatedAt: pack.activatedAt,
      },
      lastActivity: lastLog
        ? {
            action: lastLog.action,
            detail: lastLog.detail,
            timestamp: lastLog.timestamp,
            performedBy: lastLog.performedBy.name,
          }
        : null,
      history: (pack.scanLogs as HistoryLog[]).map((log) => ({
        id: log.id,
        action: log.action,
        detail: log.detail,
        timestamp: log.timestamp,
        performedBy: log.performedBy.name,
      })),
    });
  } catch (error) {
    console.error("[GET /api/tickets/history]", error);
    return NextResponse.json({ error: "Unable to search ticket history." }, { status: 500 });
  }
}
