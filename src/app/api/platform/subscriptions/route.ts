import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

const STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "INCOMPLETE"] as const;

async function requirePlatformAdmin() {
  const session = await getApiSession();
  if (!session) return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  if (session.role !== "PLATFORM_ADMIN") return { error: NextResponse.json({ error: "Platform administrator access required." }, { status: 403 }) };
  if (!prisma) return { error: NextResponse.json({ error: "Database not connected." }, { status: 503 }) };
  return { session };
}

export async function GET() {
  const access = await requirePlatformAdmin();
  if (access.error) return access.error;
  try {
    const [plans, organizations] = await Promise.all([
      prisma.plan.findMany({ where: { active: true }, orderBy: { monthlyPriceCents: "asc" } }),
      prisma.organization.findMany({ include: { subscription: { include: { plan: true } }, stores: { select: { id: true, name: true } }, owner: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } }),
    ]);
    return NextResponse.json({ plans, accounts: organizations });
  } catch (error) {
    console.error("[GET /api/platform/subscriptions]", error);
    return NextResponse.json({ error: "Unable to load subscription management data." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requirePlatformAdmin();
  if (access.error) return access.error;
  try {
    const body = await request.json().catch(() => ({}));
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
    const planId = typeof body.planId === "string" ? body.planId : "";
    const status = typeof body.status === "string" ? body.status : "";
    if (!organizationId || !planId || !STATUSES.includes(status as (typeof STATUSES)[number])) return NextResponse.json({ error: "Organization, active plan, and valid status are required." }, { status: 400 });

    const [organization, plan] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }),
      prisma.plan.findFirst({ where: { id: planId, active: true }, select: { id: true, key: true } }),
    ]);
    if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    if (!plan) return NextResponse.json({ error: "Active plan not found." }, { status: 404 });

    const subscription = await prisma.subscription.upsert({ where: { organizationId }, update: { planId: plan.id, status: status as never, cancelAtPeriodEnd: false }, create: { organizationId, planId: plan.id, status: status as never } });
    return NextResponse.json({ success: true, subscription: { id: subscription.id, organizationId, planId: plan.id, planKey: plan.key, status } });
  } catch (error) {
    console.error("[PATCH /api/platform/subscriptions]", error);
    return NextResponse.json({ error: "Unable to update subscription." }, { status: 500 });
  }
}
