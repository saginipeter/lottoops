import { prisma } from "@/lib/prisma";

let userProfileSchemaReady = false;

async function ensureUserProfileSchema() {
  if (userProfileSchemaReady || !prisma) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      employee_user_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_employee_user_id
    ON user_profiles (employee_user_id)
    WHERE employee_user_id IS NOT NULL AND employee_user_id <> ''
  `);

  userProfileSchemaReady = true;
}

export async function ensureUserProfilesTable() {
  await ensureUserProfileSchema();
}

export async function getEmployeeIdsForUsers(userIds: string[]) {
  if (!prisma || userIds.length === 0) return new Map<string, string | null>();
  await ensureUserProfileSchema();

  const rows = (await prisma.$queryRawUnsafe(
    `
    SELECT user_id AS "userId", employee_user_id AS "employeeUserId"
    FROM user_profiles
    WHERE user_id = ANY($1::text[])
    `,
    userIds
  )) as Array<{ userId: string; employeeUserId: string | null }>;

  return new Map(rows.map((row) => [row.userId, row.employeeUserId]));
}

export async function setEmployeeUserId(userId: string, employeeUserId?: string | null) {
  if (!prisma) return;
  await ensureUserProfileSchema();

  const normalized = employeeUserId && employeeUserId.trim() ? employeeUserId.trim() : null;

  if (normalized) {
    await assertEmployeeUserIdAvailable(normalized, userId);
  }

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO user_profiles (user_id, employee_user_id, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET employee_user_id = EXCLUDED.employee_user_id, updated_at = NOW()
    `,
    userId,
    normalized
  );
}

export async function assertEmployeeUserIdAvailable(employeeUserId: string, userId?: string) {
  if (!prisma) return;
  await ensureUserProfileSchema();

  const normalized = employeeUserId.trim();
  if (!normalized) return;

  const existing = (await prisma.$queryRawUnsafe(
    `
    SELECT user_id AS "userId"
    FROM user_profiles
    WHERE employee_user_id = $1
      ${userId ? "AND user_id <> $2" : ""}
    LIMIT 1
    `,
    ...(userId ? [normalized, userId] : [normalized])
  )) as Array<{ userId: string }>;

  if (existing.length > 0) {
    throw new Error("EMPLOYEE_USER_ID_TAKEN");
  }
}
