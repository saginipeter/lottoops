import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { ensureDeviceRegistrySchema, hashDeviceKey, hashPairingCode, normalizeTerminalId } from "@/lib/device-registry";

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const terminalId = normalizeTerminalId(body.terminalId);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const deviceKey = typeof body.deviceKey === "string" ? body.deviceKey.trim() : "";
  if (!terminalId || !/^\d{6}$/.test(code) || deviceKey.length < 20) {
    return NextResponse.json({ error: "Enter a valid six-digit pairing code." }, { status: 400 });
  }
  try {
    await ensureDeviceRegistrySchema();
    const rows = await prisma.$queryRawUnsafe(`
      UPDATE store_devices
      SET device_key_hash = $1, paired_at = NOW(), pairing_code_hash = NULL,
          pairing_expires_at = NULL, last_seen_at = NOW(), updated_at = NOW()
      WHERE store_id = $2 AND terminal_id = $3
        AND pairing_code_hash = $4 AND pairing_expires_at > NOW() AND active = TRUE
      RETURNING terminal_id AS "terminalId"
    `, hashDeviceKey(deviceKey), session.storeId, terminalId, hashPairingCode(session.storeId, terminalId, code));
    if (!rows[0]) return NextResponse.json({ error: "Code expired, incorrect, or terminal is inactive." }, { status: 403 });
    return NextResponse.json({ paired: true, terminalId });
  } catch (error) {
    console.error("[POST /api/devices/pair]", error);
    return NextResponse.json({ error: "Unable to pair this device." }, { status: 500 });
  }
}
