import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export interface LoginSessionAssignment {
  storeId: string;
  userId: string;
  shiftId?: string;
  terminalId?: string;
}

export function createLoginSessionId() {
  return `ls_${randomUUID()}`;
}

export async function startLoginSession(id: string, assignment: LoginSessionAssignment) {
  if (!prisma) throw new Error("Login session tracking requires a live database connection.");
  await prisma.$executeRawUnsafe(`
    INSERT INTO login_sessions (id, store_id, user_id, shift_id, terminal_id, signed_in_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
  `, id, assignment.storeId, assignment.userId, assignment.shiftId ?? null, assignment.terminalId ?? null);
}

export async function endLoginSession(id: string | null | undefined) {
  if (!prisma || !id) return;
  await prisma.$executeRawUnsafe(`
    UPDATE login_sessions SET ended_at = COALESCE(ended_at, NOW()) WHERE id = $1
  `, id);
}
