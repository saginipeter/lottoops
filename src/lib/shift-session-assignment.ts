import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { SessionPayload } from "@/lib/session";

export class ShiftAssignmentConflict extends Error {}
export class ActiveTerminalOperatorConflict extends Error {}

/** Attach a staff login to a shift without allowing a live login to switch shifts. */
export async function bindLoginSessionToShift(
  tx: Pick<Prisma.TransactionClient, "$queryRawUnsafe" | "$executeRawUnsafe">,
  session: SessionPayload,
  shift: { id: string; shiftNumber: 1 | 2; terminalId: string },
) {
  const staffSession = session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD";
  if (!staffSession) return session.loginSessionId ?? null;

  const occupied = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT ls.id
     FROM login_sessions ls
     JOIN users u ON u.id = ls.user_id
     WHERE ls.store_id = $1 AND ls.shift_id = $2 AND ls.terminal_id = $3
       AND ls.ended_at IS NULL
       AND ($4::text IS NULL OR ls.id <> $4)
       AND u.role IN ('EMPLOYEE', 'SHIFT_LEAD')
     LIMIT 1
     FOR UPDATE OF ls`,
    session.storeId,
    shift.id,
    shift.terminalId,
    session.loginSessionId ?? null,
  );
  if (occupied.length > 0) {
    const otherTerminal = shift.terminalId === "T1" ? "Terminal 2" : "Terminal 1";
    const otherShift = shift.shiftNumber === 1 ? 2 : 1;
    const terminalNumber = shift.terminalId.replace(/^T/, "");
    throw new ActiveTerminalOperatorConflict(
      `Shift ${shift.shiftNumber} Terminal ${terminalNumber} already has an active operator. Please select ${otherTerminal}, or open Shift ${otherShift} (Terminal 1 or Terminal 2).`,
    );
  }

  const currentId = session.loginSessionId;
  if (currentId) {
    const updated = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `UPDATE login_sessions
       SET shift_id = $1, terminal_id = $2
       WHERE id = $3 AND store_id = $4 AND user_id = $5 AND ended_at IS NULL
         AND (shift_id IS NULL OR shift_id = $1)
       RETURNING id`,
      shift.id,
      shift.terminalId,
      currentId,
      session.storeId,
      session.userId,
    );
    if (updated.length > 0) return currentId;

    const existing = await tx.$queryRawUnsafe<Array<{ shiftId: string | null; endedAt: Date | null }>>(
      `SELECT shift_id AS "shiftId", ended_at AS "endedAt"
       FROM login_sessions WHERE id = $1 AND store_id = $2 AND user_id = $3 FOR UPDATE`,
      currentId,
      session.storeId,
      session.userId,
    );
    if (existing[0]?.endedAt == null && existing[0]?.shiftId) {
      throw new ShiftAssignmentConflict("This login is already assigned to another open shift. Sign out before choosing a different shift.");
    }
  }

  // A closed shift ends its login-session row. Start a fresh, shift-scoped
  // session rather than reopening that historical session or changing its audit trail.
  const newId = `ls_${randomUUID()}`;
  await tx.$executeRawUnsafe(
    `INSERT INTO login_sessions (id, store_id, user_id, shift_id, terminal_id, signed_in_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    newId,
    session.storeId,
    session.userId,
    shift.id,
    shift.terminalId,
  );
  return newId;
}
