import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

const ROLES = ["OWNER", "MANAGER", "SHIFT_LEAD", "EMPLOYEE"] as const;
const PERMISSIONS = ["REPORTS", "RECEIVE_SHIPMENTS", "MANAGE_BACKSTOCK", "MANAGE_DISPLAY", "MANAGE_GAMES"] as const;

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS role_permission_defaults (role TEXT NOT NULL, permission TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (role, permission))`);
  schemaReady = true;
}
function authorized(role: string) { return role === "PLATFORM_ADMIN"; }

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!authorized(session.role)) return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    await ensureSchema();
    const rows = await prisma.$queryRawUnsafe(`SELECT role, permission, enabled FROM role_permission_defaults`) as Array<{ role: string; permission: string; enabled: boolean }>;
    return NextResponse.json({ roles: ROLES, permissions: PERMISSIONS, defaults: rows });
  } catch (error) {
    console.error("[GET /api/platform/permissions]", error);
    return NextResponse.json({ error: "Unable to load permission defaults." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!authorized(session.role)) return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  if (!ROLES.includes(body.role) || !PERMISSIONS.includes(body.permission) || typeof body.enabled !== "boolean") return NextResponse.json({ error: "Valid role, permission, and enabled status are required." }, { status: 400 });
  if (body.role === "OWNER" || body.role === "MANAGER") return NextResponse.json({ error: "Owner and Manager permissions are always granted by role." }, { status: 400 });
  try {
    await ensureSchema();
    await prisma.$executeRawUnsafe(`INSERT INTO role_permission_defaults (role, permission, enabled) VALUES ($1, $2, $3) ON CONFLICT (role, permission) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`, body.role, body.permission, body.enabled);
    return NextResponse.json({ success: true, role: body.role, permission: body.permission, enabled: body.enabled });
  } catch (error) {
    console.error("[PATCH /api/platform/permissions]", error);
    return NextResponse.json({ error: "Unable to update permission default." }, { status: 500 });
  }
}
