import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

const DEFAULT_PLANS = [
  { key: "FOUNDING_STORE", name: "Founding Store", monthlyPriceCents: 2499 },
  { key: "SINGLE_STORE", name: "Single Store", monthlyPriceCents: 3999 },
  { key: "MULTI_STORE", name: "Multi-Store", monthlyPriceCents: 7999 },
];

interface BillingPlan {
  id: string;
  key: string;
  name: string;
  monthlyPriceCents: number;
  active: boolean;
}

async function ensureBillingRecords(ownerId: string, ownerName: string) {
  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: { name: plan.name, monthlyPriceCents: plan.monthlyPriceCents, active: true },
      create: plan,
    });
  }

  let organization = await prisma.organization.findUnique({ where: { ownerUserId: ownerId } });
  if (!organization) {
    organization = await prisma.organization.create({ data: { name: `${ownerName}'s Lottoops Account`, ownerUserId: ownerId } });
  }

  await prisma.store.updateMany({
    where: { ownerUserId: ownerId, organizationId: null },
    data: { organizationId: organization.id },
  });
  return organization;
}

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "OWNER") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  try {
    const organization = await ensureBillingRecords(session.userId, session.name);
    const plans = (await prisma.plan.findMany({ where: { active: true }, orderBy: { monthlyPriceCents: "asc" } })) as BillingPlan[];
    const subscription = await prisma.subscription.findUnique({ where: { organizationId: organization.id }, include: { plan: true } });
    return NextResponse.json({ organization: { id: organization.id, name: organization.name }, plans, subscription });
  } catch (error) {
    console.error("[GET /api/billing]", error);
    return NextResponse.json({ error: "Unable to load billing information." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "OWNER") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  if (typeof body.planId !== "string" || !body.planId.trim()) return NextResponse.json({ error: "A plan is required." }, { status: 400 });

  try {
    const organization = await ensureBillingRecords(session.userId, session.name);
    const plan = await prisma.plan.findFirst({ where: { id: body.planId, active: true } });
    if (!plan) return NextResponse.json({ error: "Active plan not found." }, { status: 404 });

    const subscription = await prisma.subscription.upsert({
      where: { organizationId: organization.id },
      update: { planId: plan.id, status: "TRIALING", cancelAtPeriodEnd: false },
      create: { organizationId: organization.id, planId: plan.id, status: "TRIALING", trialEndsAt: new Date(Date.now() + 14 * 86400000) },
      include: { plan: true },
    });
    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("[POST /api/billing]", error);
    return NextResponse.json({ error: "Unable to update billing plan." }, { status: 500 });
  }
}
