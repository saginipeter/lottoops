import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { validateEndingTicket } from "@/lib/core-validation";
import { logInventoryActivity } from "@/lib/activity-log";
import { isReadOnly } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (isReadOnly(session)) return NextResponse.json({ error: "Auditor accounts are read-only." }, { status: 403 });

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const shiftId = body?.shiftId;
    const countedCash = Number(body?.countedCash);

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

    await prisma.$executeRawUnsafe(`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "terminalId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "openingCash" DECIMAL(12,2) NOT NULL DEFAULT 0`);
    await prisma.$executeRawUnsafe(`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "expectedCash" DECIMAL(12,2)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "countedCash" DECIMAL(12,2)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "cashVariance" DECIMAL(12,2)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "cashReconciledAt" TIMESTAMPTZ`);
    await prisma.$executeRawUnsafe(`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "cashReconciledById" TEXT`);
    const terminalRows = await prisma.$queryRawUnsafe(
      `SELECT COALESCE("terminalId", 'T1') AS "terminalId" FROM shifts WHERE id = $1 LIMIT 1`,
      shift.id
    ) as Array<{ terminalId: string }>;
    const terminalId = terminalRows[0]?.terminalId ?? "T1";
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      return NextResponse.json({ error: "Count the cash drawer before closing this shift." }, { status: 409 });
    }
    const cashRows = await prisma.$queryRawUnsafe(
      `SELECT COALESCE("openingCash", 0)::numeric AS "openingCash" FROM shifts WHERE id = $1 LIMIT 1`,
      shift.id
    ) as Array<{ openingCash: string | number }>;
    const openingCash = Number(cashRows[0]?.openingCash ?? 0);

    const audit = await prisma.inventoryAudit.findUnique({
      where: { shiftId: shift.id },
      select: {
        id: true,
        status: true,
        lines: { select: { beginningPhysicalTicket: true, endingPhysicalTicket: true } },
      },
    });
    const activeDisplayPackCount = await prisma.pack.count({
      where: { storeId: session.storeId, status: "ACTIVE", slot: { isNot: null } },
    });
    // A shift with no active display packs has no physical tickets to audit.
    // Do not block close on an empty 0/0 audit in this case.
    const openingAuditIncomplete = !audit || audit.lines.some((line: { beginningPhysicalTicket: number | null }) => line.beginningPhysicalTicket === null);
    const closingAuditIncomplete = Boolean(audit && audit.lines.some((line: { endingPhysicalTicket: number | null }) => line.endingPhysicalTicket === null));
    if (activeDisplayPackCount > 0 && openingAuditIncomplete) {
      return NextResponse.json(
        { error: "Complete the Opening Audit before starting the Closing Audit." },
        { status: 409 }
      );
    }
    if (activeDisplayPackCount > 0 && (closingAuditIncomplete || audit?.status !== "COMPLETED")) {
      return NextResponse.json(
        { error: "Complete the Closing Audit before closing this shift." },
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
      const ticketError = validateEndingTicket(beginning, currentTicket);
      if (ticketError) {
        return NextResponse.json(
          { error: `Invalid ending ticket for pack ${line.pack.serialNumber}. ${ticketError}` },
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

    const expectedCash = openingCash + totalSales;
    const cashVariance = countedCash - expectedCash;
    txOps.push(
      prisma.$executeRawUnsafe(
        `UPDATE shifts SET "expectedCash" = $1, "countedCash" = $2, "cashVariance" = $3, "cashReconciledAt" = NOW(), "cashReconciledById" = $4 WHERE id = $5`,
        expectedCash,
        countedCash,
        cashVariance,
        session.userId,
        shift.id
      ),
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

    await logInventoryActivity({
      storeId: session.storeId,
      action: "SHIFT_CLOSE",
      entityType: "SHIFT",
      entityId: shift.id,
      detail: "Shift closed successfully.",
      performedById: session.userId,
      performedByName: session.name,
      terminalId,
    });

    return NextResponse.json({
      success: true,
      totalTickets,
      totalSales,
      openingCash,
      expectedCash,
      countedCash,
      cashVariance,
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
