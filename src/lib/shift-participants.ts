import { prisma } from "@/lib/prisma";

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS shift_participants (shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (shift_id, user_id))`);
  schemaReady = true;
}

export async function recordShiftParticipant(shiftId: string, userId: string) {
  if (!prisma) return;
  await ensureSchema();
  await prisma.$executeRawUnsafe(`INSERT INTO shift_participants (shift_id, user_id) VALUES ($1, $2) ON CONFLICT (shift_id, user_id) DO UPDATE SET last_seen_at = NOW()`, shiftId, userId);
}

export async function getShiftParticipants(shiftId: string) {
  if (!prisma) return [];
  await ensureSchema();
  return prisma.$queryRawUnsafe(`SELECT participants.user_id AS "userId", users.name, users.email, participants.first_seen_at AS "firstSeenAt", participants.last_seen_at AS "lastSeenAt" FROM shift_participants participants JOIN users ON users.id = participants.user_id WHERE participants.shift_id = $1 ORDER BY participants.first_seen_at ASC`, shiftId);
}
