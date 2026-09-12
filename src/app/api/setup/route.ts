import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { ensureDisplaySlots } from "@/lib/services/display-slots";

// GET /api/setup — check if setup is needed (no OWNER exists yet)
export async function GET() {
  if (process.env.SETUP_ENABLED !== "true") {
    return NextResponse.json({ needed: false, locked: true });
  }
  if (!prisma) return NextResponse.json({ needed: true });

  const ownerCount = await prisma.user.count({ where: { role: "OWNER" } });
  return NextResponse.json({ needed: ownerCount === 0 });
}

// POST /api/setup — create the first owner + first store (one-time only)
export async function POST(req: NextRequest) {
  if (process.env.SETUP_ENABLED !== "true") {
    return NextResponse.json({ error: "Initial setup is locked. Set SETUP_ENABLED=true only during provisioning." }, { status: 403 });
  }
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  // Double-check: refuse if an OWNER already exists
  const ownerCount = await prisma.user.count({ where: { role: "OWNER" } });
  if (ownerCount > 0) {
    return NextResponse.json(
      { error: "Setup already complete. An owner account already exists." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { name, email, password, storeName, timezone } = body;

  if (!name?.trim() || !email?.trim() || !password?.trim() || !storeName?.trim()) {
    return NextResponse.json(
      { error: "Name, email, password, and store name are required." },
      { status: 400 }
    );
  }

  if (String(password).length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
  if (existingUser) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(String(password), 12);
  const tz = timezone ?? "America/Chicago";

  // Create store first, then owner user linked to it
  const store = await prisma.store.create({
    data: {
      name: storeName.trim(),
      timezone: tz,
    },
  });

  const user = await prisma.user.create({
    data: {
      storeId: store.id,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "OWNER",
      active: true,
    },
  });

  // Update store to record the owner
  await prisma.store.update({
    where: { id: store.id },
    data: { ownerUserId: user.id },
  });

  await ensureDisplaySlots(store.id);

  // Auto-login: issue a session cookie
  const token = await signSession({
    userId: user.id,
    storeId: store.id,
    storeName: store.name,
    name: user.name,
    email: user.email,
    role: "OWNER",
    grantedPermissions: [],
  });

  const response = NextResponse.json({
    ok: true,
    message: "Setup complete. Welcome to LottoOps!",
  });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  return response;
}
