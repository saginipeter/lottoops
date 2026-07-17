import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!prisma) {
    return NextResponse.json({ error: "Database not connected" }, { status: 503 });
  }

  try {
    const { packId, pin } = await req.json();

    if (!packId || typeof packId !== "string") {
      return NextResponse.json({ error: "packId is required." }, { status: 400 });
    }
    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ error: "PIN is required." }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS store_security_settings (
        store_id TEXT PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
        approval_pin_hash TEXT NOT NULL,
        updated_by_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS live_scan_events (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        pack_id TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
        ticket_barcode TEXT NOT NULL,
        scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(store_id, shift_id, ticket_barcode)
      )
    `);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const securityRows = (await prisma.$queryRawUnsafe(
      `
      SELECT approval_pin_hash
      FROM store_security_settings
      WHERE store_id = $1
      LIMIT 1
      `,
      session.storeId
    )) as { approval_pin_hash: string }[];

    if (securityRows.length === 0) {
      return NextResponse.json(
        { error: "Approval PIN not configured. Manager must set it in Settings first." },
        { status: 409 }
      );
    }

    const pinValid = await bcrypt.compare(pin, securityRows[0].approval_pin_hash);
    if (!pinValid) {
      return NextResponse.json({ error: "Invalid approval PIN." }, { status: 403 });
    }

    const openShift = await prisma.shift.findFirst({
      where: { storeId: session.storeId, status: "OPEN" },
      include: {
        lines: {
          where: { packId },
          take: 1,
        },
      },
      orderBy: { openedAt: "desc" },
    });

    if (!openShift || openShift.lines.length === 0) {
      return NextResponse.json(
        { error: "No open shift line found for this pack." },
        { status: 400 }
      );
    }

    const line = openShift.lines[0];
    const pack = await prisma.pack.findFirst({
      where: { id: packId, storeId: session.storeId },
      select: {
        id: true,
        status: true,
        serialNumber: true,
        currentTicketNumber: true,
        game: { select: { price: true } },
      },
    });

    if (!pack) {
      return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    }
    if (pack.status !== "ACTIVE" && pack.status !== "SOLD_OUT") {
      return NextResponse.json(
        { error: "Only ACTIVE or SOLD_OUT packs can be reversed." },
        { status: 409 }
      );
    }

    const beginning = Number(line.beginningTicket ?? 0);
    const current = Number(pack.currentTicketNumber ?? beginning);
    if (current >= beginning) {
      return NextResponse.json(
        { error: "No recent sale to reverse for this pack." },
        { status: 409 }
      );
    }

    const restoredCurrent = Math.min(current + 1, beginning);
    const ticketsSold = Math.max(beginning - restoredCurrent, 0);

    const slot = await prisma.displaySlot.findFirst({
      where: { storeId: session.storeId, slotNumber: line.slotNumber },
      select: { id: true, packId: true },
    });

    if (!slot) {
      return NextResponse.json(
        { error: `Original slot ${line.slotNumber} was not found.` },
        { status: 404 }
      );
    }

    if (slot.packId && slot.packId !== pack.id) {
      return NextResponse.json(
        { error: `Original slot ${line.slotNumber} is occupied. Clear it before returning this pack.` },
        { status: 409 }
      );
    }

    const salesAmount = ticketsSold * Number(pack.game.price);

    await prisma.$transaction([
      prisma.pack.update({
        where: { id: pack.id },
        data: {
          status: "ACTIVE",
          currentTicketNumber: restoredCurrent,
          completedAt: null,
        },
      }),
      prisma.$executeRawUnsafe(
        `
        DELETE FROM live_scan_events
        WHERE id IN (
          SELECT id
          FROM live_scan_events
          WHERE store_id = $1
            AND shift_id = $2
            AND pack_id = $3
          ORDER BY scanned_at DESC
          LIMIT 1
        )
        `,
        session.storeId,
        openShift.id,
        pack.id
      ),
      prisma.shiftLine.update({
        where: { id: line.id },
        data: {
          endingTicket: restoredCurrent,
          ticketsSold,
          salesAmount,
        },
      }),
      prisma.displaySlot.update({
        where: { id: slot.id },
        data: { packId: pack.id },
      }),
      prisma.scanLogEntry.create({
        data: {
          storeId: session.storeId,
          action: "RETURNED",
          packId: pack.id,
          performedById: session.userId,
          detail: `Rejected sale reversed for pack ${pack.serialNumber}. Restored to slot ${line.slotNumber}.`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      packId: pack.id,
      currentTicketNumber: restoredCurrent,
      slotNumber: line.slotNumber,
    });
  } catch (error) {
    console.error("[POST /api/packs/reverse-sale]", error);
    return NextResponse.json(
      { error: "Unable to reverse the last sale." },
      { status: 500 }
    );
  }
}
