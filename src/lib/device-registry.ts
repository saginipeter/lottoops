import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

let schemaReady = false;

export async function ensureDeviceRegistrySchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS store_devices (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      terminal_id TEXT NOT NULL,
      device_type TEXT NOT NULL DEFAULT 'REGISTER',
      scanner_model TEXT,
      scanner_serial TEXT,
      scanner_settings TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ,
      device_key_hash TEXT,
      pairing_code_hash TEXT,
      pairing_expires_at TIMESTAMPTZ,
      paired_at TIMESTAMPTZ,
      UNIQUE(store_id, terminal_id)
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE store_devices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
  await prisma.$executeRawUnsafe(`ALTER TABLE store_devices ADD COLUMN IF NOT EXISTS device_key_hash TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE store_devices ADD COLUMN IF NOT EXISTS pairing_code_hash TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE store_devices ADD COLUMN IF NOT EXISTS pairing_expires_at TIMESTAMPTZ`);
  await prisma.$executeRawUnsafe(`ALTER TABLE store_devices ADD COLUMN IF NOT EXISTS paired_at TIMESTAMPTZ`);
  schemaReady = true;
}

export function normalizeTerminalId(value: unknown) {
  return typeof value === "string" && /^T\d{1,3}$/i.test(value.trim())
    ? value.trim().toUpperCase()
    : null;
}

export function hashDeviceKey(deviceKey: string) {
  return createHash("sha256").update(`lottoops-device:${deviceKey}`).digest("hex");
}

export function hashPairingCode(storeId: string, terminalId: string, code: string) {
  return createHash("sha256").update(`${storeId}:${terminalId}:${code}`).digest("hex");
}

export async function createDevicePairingCode(storeId: string, deviceId: string) {
  if (!prisma) return null;
  await ensureDeviceRegistrySchema();
  const code = String(randomInt(100000, 1000000));
  const rows = await prisma.$queryRawUnsafe(
    `UPDATE store_devices
     SET pairing_code_hash = $1, pairing_expires_at = NOW() + INTERVAL '10 minutes', updated_at = NOW()
     WHERE id = $2 AND store_id = $3
     RETURNING terminal_id AS "terminalId", pairing_expires_at AS "pairingExpiresAt"`,
    hashPairingCode(storeId, "pending", code),
    deviceId,
    storeId,
  ) as Array<{ terminalId: string; pairingExpiresAt: Date }>;
  const device = rows[0];
  if (!device) return null;

  await prisma.$executeRawUnsafe(
    `UPDATE store_devices SET pairing_code_hash = $1 WHERE id = $2 AND store_id = $3`,
    hashPairingCode(storeId, device.terminalId, code),
    deviceId,
    storeId,
  );
  return { code, terminalId: device.terminalId, pairingExpiresAt: device.pairingExpiresAt };
}

export async function authorizeRegisteredDevice(
  storeId: string,
  terminalId: string,
  deviceKey: unknown,
) {
  if (!prisma) return { required: false, authorized: true, reason: "Registry unavailable." };
  await ensureDeviceRegistrySchema();
  const countRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM store_devices WHERE store_id = $1`,
    storeId,
  ) as Array<{ count: number }>;
  if (Number(countRows[0]?.count ?? 0) === 0) {
    return { required: false, authorized: true, reason: "No devices registered for this store." };
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, active, device_key_hash AS "deviceKeyHash"
     FROM store_devices WHERE store_id = $1 AND terminal_id = $2 LIMIT 1`,
    storeId,
    terminalId,
  ) as Array<{ id: string; active: boolean; deviceKeyHash: string | null }>;
  const device = rows[0];
  if (!device) return { required: true, authorized: false, reason: `Terminal ${terminalId} is not registered.` };
  if (!device.active) return { required: true, authorized: false, reason: `Terminal ${terminalId} is inactive.` };
  if (typeof deviceKey !== "string" || !deviceKey.trim()) {
    return { required: true, authorized: false, reason: "This device is not paired. Open the employee workspace to pair it." };
  }
  if (!device.deviceKeyHash || device.deviceKeyHash !== hashDeviceKey(deviceKey.trim())) {
    return { required: true, authorized: false, reason: `This device is not authorized for terminal ${terminalId}.` };
  }

  await prisma.$executeRawUnsafe(
    `UPDATE store_devices SET last_seen_at = NOW(), updated_at = NOW() WHERE id = $1`,
    device.id,
  );
  return { required: true, authorized: true, reason: "Device authorized.", deviceId: device.id };
}
