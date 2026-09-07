import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";

let schemaReady = false;

async function ensureSchema() {
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
      UNIQUE(store_id, terminal_id)
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE store_devices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
  schemaReady = true;
}

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    await ensureSchema();
    const devices = await prisma.$queryRawUnsafe(`
      SELECT id, terminal_id AS "terminalId", device_type AS "deviceType",
             scanner_model AS "scannerModel", scanner_serial AS "scannerSerial",
             scanner_settings AS "scannerSettings", active,
             created_at AS "createdAt", updated_at AS "updatedAt", last_seen_at AS "lastSeenAt"
      FROM store_devices WHERE store_id = $1 ORDER BY terminal_id ASC
    `, session.storeId);
    return NextResponse.json({ devices });
  } catch (error) {
    console.error("[GET /api/devices]", error);
    return NextResponse.json({ error: "Unable to load registered devices." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const terminalId = typeof body.terminalId === "string" ? body.terminalId.trim().toUpperCase() : "";
  const deviceType = typeof body.deviceType === "string" ? body.deviceType.trim().toUpperCase() : "REGISTER";
  const scannerModel = typeof body.scannerModel === "string" ? body.scannerModel.trim() : null;
  const scannerSerial = typeof body.scannerSerial === "string" ? body.scannerSerial.trim() : null;
  const scannerSettings = typeof body.scannerSettings === "string" ? body.scannerSettings.trim() : null;
  if (!terminalId || !/^T\d{1,3}$/.test(terminalId)) return NextResponse.json({ error: "Terminal ID must look like T1 or T2." }, { status: 400 });

  try {
    await ensureSchema();
    const id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const devices = await prisma.$queryRawUnsafe(`
      INSERT INTO store_devices (id, store_id, terminal_id, device_type, scanner_model, scanner_serial, scanner_settings)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (store_id, terminal_id) DO UPDATE SET
        device_type = EXCLUDED.device_type, scanner_model = EXCLUDED.scanner_model,
        scanner_serial = EXCLUDED.scanner_serial, scanner_settings = EXCLUDED.scanner_settings,
        active = TRUE, updated_at = NOW()
      RETURNING id, terminal_id AS "terminalId", device_type AS "deviceType", scanner_model AS "scannerModel", scanner_serial AS "scannerSerial", scanner_settings AS "scannerSettings", active
    `, id, session.storeId, terminalId, deviceType || "REGISTER", scannerModel, scannerSerial, scannerSettings);
    return NextResponse.json({ device: devices[0] }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/devices]", error);
    return NextResponse.json({ error: "Unable to register device." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== "string") return NextResponse.json({ error: "Device ID is required." }, { status: 400 });
  try {
    await ensureSchema();
    const checkIn = body.checkIn === true;
    if (!checkIn && typeof body.active !== "boolean") return NextResponse.json({ error: "Active status is required." }, { status: 400 });
    const devices = await prisma.$queryRawUnsafe(checkIn
      ? `UPDATE store_devices SET last_seen_at = NOW(), updated_at = NOW() WHERE id = $1 AND store_id = $2 RETURNING id, terminal_id AS "terminalId", active, last_seen_at AS "lastSeenAt"`
      : `UPDATE store_devices SET active = $1, updated_at = NOW() WHERE id = $2 AND store_id = $3 RETURNING id, terminal_id AS "terminalId", active, last_seen_at AS "lastSeenAt"`,
      ...(checkIn ? [body.id, session.storeId] : [body.active, body.id, session.storeId]));
    if (!devices[0]) return NextResponse.json({ error: "Device not found." }, { status: 404 });
    return NextResponse.json({ device: devices[0] });
  } catch (error) {
    console.error("[PATCH /api/devices]", error);
    return NextResponse.json({ error: "Unable to update device." }, { status: 500 });
  }
}
