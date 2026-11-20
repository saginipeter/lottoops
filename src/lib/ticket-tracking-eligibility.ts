import { prisma } from "@/lib/prisma";

export interface TicketTrackingShift {
  id: string;
  shiftNumber: 1 | 2;
  terminalId: string;
}

export function isOpeningAuditComplete(
  auditStatus: string | null | undefined,
  auditLines: Array<{ packId: string; beginningPhysicalTicket: number | null }> | null | undefined,
  activeDisplayPackIds: readonly string[],
) {
  if (auditStatus !== "OPEN") return false;
  const lines = auditLines ?? [];
  return activeDisplayPackIds.every((packId) =>
    lines.some((line) => line.packId === packId && line.beginningPhysicalTicket !== null),
  );
}

/**
 * Resolve an active shift only while its opening audit is still open and every
 * active display pack has a recorded beginning physical ticket. This mirrors
 * the authoritative live-scan gate and is intentionally checked from the DB
 * on every page load and every login restoration.
 */
export async function getEligibleTicketTrackingShift(
  storeId: string,
  shiftId: string,
): Promise<TicketTrackingShift | null> {
  if (!prisma) return null;

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, storeId, status: "OPEN" },
    select: { id: true, shiftNumber: true, terminalId: true },
  });
  if (!shift?.terminalId || (shift.shiftNumber !== 1 && shift.shiftNumber !== 2)) return null;

  const [audit, activeDisplayPacks] = await Promise.all([
    prisma.inventoryAudit.findUnique({
      where: { shiftId: shift.id },
      select: {
        status: true,
        lines: { select: { packId: true, beginningPhysicalTicket: true } },
      },
    }),
    prisma.pack.findMany({
      where: { storeId, status: "ACTIVE", slot: { isNot: null } },
      select: { id: true },
    }),
  ]);
  const displayPacks = activeDisplayPacks as Array<{ id: string }>;

  const openingAuditComplete = isOpeningAuditComplete(
    audit?.status,
    audit?.lines,
    displayPacks.map((pack) => pack.id),
  );
  return openingAuditComplete
    ? { id: shift.id, shiftNumber: shift.shiftNumber, terminalId: shift.terminalId }
    : null;
}

/**
 * Restore the most recently used eligible shift for this employee/store. Past
 * login rows are retained as assignment history; the referenced shift and its
 * audit are revalidated live before any new session is bound to them.
 */
export async function findRestorableEmployeeShift(
  storeId: string,
  userId: string,
): Promise<TicketTrackingShift | null> {
  if (!prisma) return null;

  const assignments = await prisma.$queryRawUnsafe(`
    SELECT s.id AS id, s.shift_number AS "shiftNumber", s."terminalId" AS "terminalId"
    FROM login_sessions ls
    JOIN shifts s ON s.id = ls.shift_id AND s."storeId" = ls.store_id
    WHERE ls.store_id = $1 AND ls.user_id = $2
      AND s.status = 'OPEN'
      AND s.shift_number IN (1, 2)
      AND ls.terminal_id IS NOT NULL
      AND ls.terminal_id = s."terminalId"
    GROUP BY s.id, s.shift_number, s."terminalId"
    ORDER BY MAX(ls.signed_in_at) DESC
    LIMIT 25
  `, storeId, userId) as TicketTrackingShift[];

  for (const assignment of assignments) {
    const eligible = await getEligibleTicketTrackingShift(storeId, assignment.id);
    if (eligible && eligible.terminalId === assignment.terminalId) return eligible;
  }
  return null;
}
