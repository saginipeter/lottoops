import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

const DEFAULT_PLANS = [
  {
    key: "CORE",
    name: "CORE",
    description: "Core single-store receiving, inventory, shifts, and standard reports.",
    features: ["Pack receiving and back stock", "Activation and display assignment", "Shift readings and sales", "Standard operational reports", "Individual employee access"],
    monthlyPriceCents: 3999,
  },
  {
    key: "CONTROL",
    name: "CONTROL",
    description: "Live ticket control, exceptions, protected corrections, and accountability.",
    features: ["Everything in CORE", "Live expected-ticket controls", "Exception alerts and resolution", "Audit and correction history", "Standard price $79/month; founding offer $59/month for 12 months when eligible"],
    monthlyPriceCents: 7900,
  },
  {
    key: "COMMAND",
    name: "COMMAND",
    description: "Multi-store oversight, customer display, and advanced operational visibility.",
    features: ["Everything in CONTROL", "Multiple store locations", "Consolidated owner dashboard", "Customer-facing Live display", "Cross-store reports and analytics"],
    monthlyPriceCents: 7999,
  },
];

interface BillingPlan {
  id: string;
  key: string;
  name: string;
  monthlyPriceCents: number;
  active: boolean;
  description: string;
  features: string[];
}

async function ensureBillingRecords(ownerId: string, ownerName: string) {
  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: { name: plan.name, monthlyPriceCents: plan.monthlyPriceCents, active: true },
      create: plan,
    });
  }
  await prisma.plan.updateMany({
    where: { key: { in: ["FOUNDING_STORE", "SINGLE_STORE", "MULTI_STORE"] } },
    data: { active: false },
  });

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
      create: { organizationId: organization.id, planId: plan.id, status: "TRIALING", trialEndsAt: new Date(Date.now() + 30 * 86400000) },
      include: { plan: true },
    });
    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("[POST /api/billing]", error);
    return NextResponse.json({ error: "Unable to update billing plan." }, { status: 500 });
  }
}
