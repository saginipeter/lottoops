import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove, isReadOnly } from "@/lib/permissions";
import { validateEndingTicket } from "@/lib/core-validation";

interface ShiftLineRecord {
  id: string;
  shiftId: string;
  beginningTicket: number;
  shift: { id: string; storeId: string; status: string };
  pack: { id: string; ticketPrice?: number | null; game: { price: number } };
}

interface SaleCount {
  packId: string;
  ticketsSold: number | bigint;
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isReadOnly(session)) return NextResponse.json({ error: "Auditor accounts are read-only." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  try {
    const body = await req.json().catch(() => ({}));
    if (!Array.isArray(body?.lines)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const lineIds: string[] = Array.from(new Set<string>((body.lines as unknown[])
      .flatMap((line): string[] => {
        if (typeof line !== "object" || line === null || !("id" in line) || typeof line.id !== "string") return [];
        const id = line.id.trim();
        return id ? [id] : [];
      })));
    if (lineIds.length === 0) return NextResponse.json({ error: "No shift lines provided." }, { status: 400 });

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const records = await tx.shiftLine.findMany({
        where: { id: { in: lineIds } },
        include: { shift: true, pack: { include: { game: true } } },
      }) as unknown as ShiftLineRecord[];
      if (records.length !== lineIds.length) throw new Error("SHIFT_LINES_NOT_FOUND");
      const shiftIds = [...new Set(records.map((line) => line.shiftId))].sort();
      if (shiftIds.length !== 1) throw new Error("SINGLE_SHIFT_REQUIRED");
      const shiftId = shiftIds[0];

      // Use the same shift lock that serializes sales and close operations.
      await tx.$queryRawUnsafe(
        `SELECT id FROM shifts WHERE id = $1 AND "storeId" = $2 FOR UPDATE`,
        shiftId, session.storeId,
      );
      const lockedShift = await tx.shift.findFirst({ where: { id: shiftId, storeId: session.storeId } });
      if (!lockedShift) throw new Error("SHIFT_ACCESS_DENIED");
      if (lockedShift.status !== "OPEN") throw new Error("SHIFT_NOT_OPEN");
      if (!isManagerOrAbove(session) && session.shiftId !== shiftId) throw new Error("SHIFT_ACCESS_DENIED");

      const saleCounts = await tx.$queryRawUnsafe<SaleCount[]>(
        `SELECT pack_id AS "packId", COUNT(*)::int AS "ticketsSold"
         FROM live_scan_events
         WHERE store_id = $1 AND shift_id = $2 AND pack_id = ANY($3::text[])
         GROUP BY pack_id`,
        session.storeId, shiftId, records.map((line) => line.pack.id),
      );
      const countByPack = new Map(saleCounts.map((row) => [row.packId, Number(row.ticketsSold)]));
      const updates = [] as Array<{ id: string; endingTicket: number; ticketsSold: number; salesAmount: number }>;
      for (const line of records) {
        if (line.shift.storeId !== session.storeId) throw new Error("SHIFT_ACCESS_DENIED");
        const ticketsSold = countByPack.get(line.pack.id) ?? 0;
        const endingTicket = Math.max(Number(line.beginningTicket) - ticketsSold, 0);
        const ticketError = validateEndingTicket(Number(line.beginningTicket), endingTicket);
        if (ticketError) throw new Error(`INVALID_ENDING_TICKET:${ticketError}`);
        const salesAmount = Math.round((ticketsSold * Number(line.pack.ticketPrice ?? line.pack.game.price) + Number.EPSILON) * 100) / 100;
        updates.push({ id: line.id, endingTicket, ticketsSold, salesAmount });
      }
      for (const update of updates) {
        await tx.shiftLine.update({
          where: { id: update.id },
          data: { endingTicket: update.endingTicket, ticketsSold: update.ticketsSold, salesAmount: update.salesAmount },
        });
      }
      return { shiftId, updatedLines: updates.length };
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "SHIFT_LINES_NOT_FOUND") return NextResponse.json({ error: "Some shift lines were not found." }, { status: 404 });
    if (code === "SHIFT_ACCESS_DENIED") return NextResponse.json({ error: "Invalid shift line access." }, { status: 403 });
    if (code === "SINGLE_SHIFT_REQUIRED") return NextResponse.json({ error: "Update one shift at a time." }, { status: 400 });
    if (code === "SHIFT_NOT_OPEN") return NextResponse.json({ error: "Only an open shift can be reconciled." }, { status: 409 });
    if (code.startsWith("INVALID_ENDING_TICKET:")) return NextResponse.json({ error: code.slice("INVALID_ENDING_TICKET:".length) }, { status: 409 });
    console.error("[POST /api/shifts/update-lines]", error);
    return NextResponse.json({ error: "Unable to update shift lines." }, { status: 500 });
  }
}
