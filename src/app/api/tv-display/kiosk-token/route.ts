import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { signTvKioskToken } from "@/lib/tv-kiosk";
import { getPlanAccess } from "@/lib/plan-access";

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function parseScreenNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 10_000
    ? value
    : null;
}

async function readRequestedScreen(request: Request): Promise<number | null> {
  const rawBody = await request.text();
  if (!rawBody.trim()) return 1;
  try {
    const body: unknown = JSON.parse(rawBody);
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const requested = (body as { screen?: unknown }).screen;
    return requested === undefined ? 1 : parseScreenNumber(requested);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  const displayAccess = await getPlanAccess(session, "LIVE_DISPLAY");
  if (!displayAccess.allowed) return NextResponse.json({ error: "Live Display is not enabled for this plan." }, { status: 403 });
  const screenNumber = await readRequestedScreen(request);
  if (screenNumber === null) {
    return NextResponse.json({ error: "Screen must be a positive whole number no greater than 10000." }, { status: 400 });
  }
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const store = await prisma.store.findFirst({
    where: { id: session.storeId },
    select: { id: true, name: true },
  });
  if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });

  const token = await signTvKioskToken({ storeId: store.id, storeName: store.name }, TOKEN_TTL_SECONDS);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const kioskUrl = `${origin}/tv-display?token=${encodeURIComponent(token)}&kiosk=1&screen=${screenNumber}`;

  return NextResponse.json({
    kioskUrl,
    expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
  });
}
