import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logInventoryActivity } from "@/lib/activity-log";
import { createInventoryNotification } from "@/lib/inventory-notifications";
import { getApiSession } from "@/lib/api-session";
import { getAuditPhysicalTicket } from "@/lib/ticket-quantity";
import { calculatePhysicalAuditVariance } from "@/lib/core-validation";

class AuditCloseError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

interface ActivePack {
  id: string;
  serialNumber: string;
  packNumber: string | null;
  currentTicketNumber: number | null;
  firstTicket: number | null;
  ticketQuantity: number | null;
  firstOrLastTicket: string | null;
  game: { ticketsPerPack: number | null; gameNumber: string };
}

interface AuditLine {
  id: string;
  packId: string;
  expectedTicket: number;
  beginningPhysicalTicket: number | null;
  endingPhysicalTicket: number | null;
}

interface ResolvedAuditLine {
  line: AuditLine;
  expected: number;
  variance: number;
  pack: ActivePack;
}

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role === "AUDITOR") return NextResponse.json({ error: "Auditor accounts are read-only." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const auditId = typeof body?.auditId === "string" ? body.auditId.trim() : "";
  if (!auditId) return NextResponse.json({ error: "auditId is required." }, { status: 400 });

  try {
    const header = await prisma.inventoryAudit.findFirst({
      where: { id: auditId, storeId: session.storeId },
      select: { shiftId: true },
    });
    if (!header) return NextResponse.json({ error: "Open audit not found." }, { status: 404 });
    if ((session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD") && session.shiftId !== header.shiftId) {
      return NextResponse.json({ error: "You can only complete the audit for your assigned numbered shift." }, { status: 403 });
    }

    const result: { auditId: string; shiftId: string; resolved: ResolvedAuditLine[] } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const lockedShift = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM shifts WHERE id = $1 AND "storeId" = $2 AND status = 'OPEN' FOR UPDATE`,
        header.shiftId, session.storeId,
      );
      if (lockedShift.length === 0) throw new AuditCloseError("The numbered shift is no longer open.", 409);
      const audit = await tx.inventoryAudit.findFirst({
        where: { id: auditId, storeId: session.storeId, shiftId: header.shiftId, status: "OPEN" },
        include: { lines: true },
      });
      if (!audit) throw new AuditCloseError("Open audit not found.", 404);

      // Hold all shared active-pack rows until audit completion commits.
      await tx.$queryRawUnsafe(`
        SELECT p.id FROM packs p
        JOIN display_slots d ON d."packId" = p.id
        WHERE p."storeId" = $1 AND p.status = 'ACTIVE'
        ORDER BY p.id FOR UPDATE OF p
      `, session.storeId);
      const activePacks = await tx.pack.findMany({
        where: { storeId: session.storeId, status: "ACTIVE", slot: { isNot: null } },
        select: {
          id: true, serialNumber: true, packNumber: true, currentTicketNumber: true, firstTicket: true, ticketQuantity: true,
          firstOrLastTicket: true, game: { select: { ticketsPerPack: true, gameNumber: true } },
        },
      }) as ActivePack[];
      const lines = audit.lines as AuditLine[];
      const lineByPack = new Map(lines.map((line) => [line.packId, line]));
      const missing = activePacks.filter((pack) => !lineByPack.has(pack.id));
      if (missing.length > 0) throw new AuditCloseError(`${missing.length} active display pack audit scan(s) are still required.`, 409);
      const incomplete = activePacks.filter((pack) => {
        const line = lineByPack.get(pack.id)!;
        return line.beginningPhysicalTicket === null || line.endingPhysicalTicket === null;
      });
      if (incomplete.length > 0) throw new AuditCloseError(`${incomplete.length} display pack audit scan(s) are still required.`, 409);

      const resolved: ResolvedAuditLine[] = activePacks.map((pack) => {
        const line = lineByPack.get(pack.id)!;
        const expected = getAuditPhysicalTicket({
          currentTicketNumber: pack.currentTicketNumber,
          firstTicket: pack.firstTicket,
          ticketQuantity: pack.ticketQuantity ?? pack.game.ticketsPerPack,
          firstOrLastTicket: pack.firstOrLastTicket,
        });
        const variance = calculatePhysicalAuditVariance(expected, Number(line.endingPhysicalTicket)) ?? 0;
        return { line, expected, variance, pack };
      });
      for (const { line, expected, variance } of resolved) {
        await tx.inventoryAuditLine.update({ where: { id: line.id }, data: { endingExpectedTicket: expected, variance } });
      }
      await tx.inventoryAudit.update({
        where: { id: audit.id },
        data: { status: "COMPLETED", endedById: session.userId, endedAt: new Date() },
      });
      return { auditId: audit.id, shiftId: audit.shiftId, resolved };
    }, { isolationLevel: "Serializable" });

    await logInventoryActivity({
      storeId: session.storeId,
      action: "ENDING_AUDIT_COMPLETED",
      entityType: "SHIFT",
      entityId: result.shiftId,
      detail: `Ending inventory audit completed with ${result.resolved.filter(({ variance }) => variance !== 0).length} variance(s).`,
      performedById: session.userId,
      performedByName: session.name,
    }).catch((error) => console.warn("Unable to log ending audit completion", error));
    const varianceLines = result.resolved.filter(({ variance }) => variance !== 0);
    await Promise.all(varianceLines.map(({ line, expected, pack }) => createInventoryNotification({
      storeId: session.storeId,
      type: "INVENTORY_AUDIT_VARIANCE",
      entityId: line.id,
      packId: pack.id,
      title: "Physical audit variance requires review",
      detail: `Pack #${pack.packNumber ?? pack.serialNumber} · Game #${pack.game.gameNumber}: expected physical ticket ${expected}, observed ${line.endingPhysicalTicket}.`,
      severity: "URGENT",
    }).catch((error) => console.warn("Unable to create audit variance notification", error))));
    return NextResponse.json({ success: true, auditId: result.auditId });
  } catch (error) {
    if (error instanceof AuditCloseError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[POST /api/inventory-audits/end]", error);
    return NextResponse.json({ error: "Unable to complete inventory audit." }, { status: 500 });
  }
}
