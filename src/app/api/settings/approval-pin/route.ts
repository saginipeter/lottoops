import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

async function ensureApprovalPinSchema() {
  if (!prisma) throw new Error("Database not connected");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS store_security_settings (
      store_id TEXT PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
      approval_pin_hash TEXT NOT NULL,
      updated_by_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function GET() {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.role !== "MANAGER" && session.role !== "OWNER") {
    return NextResponse.json({ error: "Managers only" }, { status: 403 });
  }
  if (!prisma) {
    return NextResponse.json({ error: "Database not connected" }, { status: 503 });
  }

  try {
    await ensureApprovalPinSchema();

    const rows = (await prisma.$queryRawUnsafe(
      `
      SELECT updated_at
      FROM store_security_settings
      WHERE store_id = $1
      LIMIT 1
      `,
      session.storeId
    )) as { updated_at: Date }[];

    const configured = rows.length > 0;
    return NextResponse.json({
      configured,
      updatedAt: configured ? rows[0].updated_at : null,
    });
  } catch (error) {
    console.error("[GET /api/settings/approval-pin]", error);
    return NextResponse.json({ error: "Unable to load approval PIN settings." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.role !== "MANAGER" && session.role !== "OWNER") {
    return NextResponse.json({ error: "Managers only" }, { status: 403 });
  }
  if (!prisma) {
    return NextResponse.json({ error: "Database not connected" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const pin = String(body?.pin ?? "");
    const confirmPin = String(body?.confirmPin ?? "");

    if (!/^\d{4,8}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4 to 8 digits." },
        { status: 400 }
      );
    }
    if (pin !== confirmPin) {
      return NextResponse.json({ error: "PIN confirmation does not match." }, { status: 400 });
    }

    await ensureApprovalPinSchema();
    const pinHash = await bcrypt.hash(pin, 12);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO store_security_settings (store_id, approval_pin_hash, updated_by_id, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (store_id)
      DO UPDATE SET
        approval_pin_hash = EXCLUDED.approval_pin_hash,
        updated_by_id = EXCLUDED.updated_by_id,
        updated_at = NOW()
      `,
      session.storeId,
      pinHash,
      session.userId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/settings/approval-pin]", error);
    return NextResponse.json({ error: "Unable to save approval PIN." }, { status: 500 });
  }
}

