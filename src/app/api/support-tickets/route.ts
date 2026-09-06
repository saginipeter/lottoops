import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      created_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_support_tickets_store_status ON support_tickets(store_id, status, created_at DESC)`);
  schemaReady = true;
}

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    await ensureSchema();
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, subject, description, priority, status,
             created_at AS "createdAt", updated_at AS "updatedAt",
             created_by_id AS "createdById"
      FROM support_tickets
      WHERE store_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, session.storeId);
    return NextResponse.json({ tickets: rows });
  } catch (error) {
    console.error("[GET /api/support-tickets]", error);
    return NextResponse.json({ error: "Unable to load support tickets." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const priority = body.priority === "HIGH" || body.priority === "URGENT" ? body.priority : "NORMAL";
  if (!subject || !description) return NextResponse.json({ error: "Subject and description are required." }, { status: 400 });
  if (subject.length > 160 || description.length > 5000) return NextResponse.json({ error: "Subject or description is too long." }, { status: 400 });

  try {
    await ensureSchema();
    const id = `support_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO support_tickets (id, store_id, created_by_id, subject, description, priority)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, subject, description, priority, status, created_at AS "createdAt"
    `, id, session.storeId, session.userId, subject, description, priority);
    return NextResponse.json({ ticket: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/support-tickets]", error);
    return NextResponse.json({ error: "Unable to create support ticket." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(body.status) ? body.status : null;
  if (!id || !status) return NextResponse.json({ error: "Ticket ID and valid status are required." }, { status: 400 });

  try {
    await ensureSchema();
    const rows = await prisma.$queryRawUnsafe(`
      UPDATE support_tickets SET status = $1, updated_at = NOW()
      WHERE id = $2 AND store_id = $3
      RETURNING id, subject, description, priority, status, updated_at AS "updatedAt"
    `, status, id, session.storeId);
    if (!rows[0]) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    return NextResponse.json({ ticket: rows[0] });
  } catch (error) {
    console.error("[PATCH /api/support-tickets]", error);
    return NextResponse.json({ error: "Unable to update support ticket." }, { status: 500 });
  }
}
