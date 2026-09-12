import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { getStripe, getStripePriceId } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "OWNER") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (process.env.BILLING_ENABLED !== "true") return NextResponse.json({ error: "Billing is not enabled." }, { status: 503 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  if (!planId) return NextResponse.json({ error: "A plan is required." }, { status: 400 });

  const organization = await prisma.organization.findUnique({ where: { ownerUserId: session.userId } });
  if (!organization) return NextResponse.json({ error: "Billing organization not found." }, { status: 404 });

  const plan = await prisma.plan.findFirst({ where: { id: planId, active: true } });
  if (!plan) return NextResponse.json({ error: "Active plan not found." }, { status: 404 });

  const priceId = plan.providerPriceId ?? getStripePriceId(plan.key);
  if (!priceId) return NextResponse.json({ error: `Stripe price is not configured for ${plan.key}.` }, { status: 503 });
  if (!plan.providerPriceId) await prisma.plan.update({ where: { id: plan.id }, data: { providerPriceId: priceId } });

  let customerId = (await prisma.paymentCustomer.findUnique({ where: { organizationId: organization.id } }))?.providerCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: organization.name,
      email: session.email,
      metadata: { organizationId: organization.id, ownerUserId: session.userId },
    });
    customerId = customer.id;
    await prisma.paymentCustomer.create({ data: { organizationId: organization.id, providerCustomerId: customerId } });
  }

  const origin = request.nextUrl.origin;
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/billing?checkout=cancelled`,
    allow_promotion_codes: true,
    billing_address_collection: "required",
    metadata: { organizationId: organization.id, planId: plan.id, planKey: plan.key },
    subscription_data: { metadata: { organizationId: organization.id, planId: plan.id, planKey: plan.key } },
  });

  return NextResponse.json({ url: checkout.url });
}
