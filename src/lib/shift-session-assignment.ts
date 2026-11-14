import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { SessionPayload } from "@/lib/session";

export class ShiftAssignmentConflict extends Error {}

/** Attach a staff login to a shift without allowing a live login to switch shifts. */
export async function bindLoginSessionToShift(
  tx: Pick<Prisma.TransactionClient, "$queryRawUnsafe" | "$executeRawUnsafe">,
  session: SessionPayload,
  shift: { id: string; terminalId: string },
) {
  const staffSession = session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD";
  if (!staffSession) return session.loginSessionId ?? null;

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
