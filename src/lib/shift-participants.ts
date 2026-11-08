import { prisma } from "@/lib/prisma";

export async function recordShiftParticipant(shiftId: string, userId: string) {
  if (!prisma) return;
  await prisma.$executeRawUnsafe(`INSERT INTO shift_participants (shift_id, user_id) VALUES ($1, $2) ON CONFLICT (shift_id, user_id) DO UPDATE SET last_seen_at = NOW()`, shiftId, userId);
}

export async function getShiftParticipants(shiftId: string) {
  if (!prisma) return [];
  return prisma.$queryRawUnsafe(`SELECT participants.user_id AS "userId", users.name, users.email, participants.first_seen_at AS "firstSeenAt", participants.last_seen_at AS "lastSeenAt" FROM shift_participants participants JOIN users ON users.id = participants.user_id WHERE participants.shift_id = $1 ORDER BY participants.first_seen_at ASC`, shiftId);
}
