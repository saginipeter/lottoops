import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { ensureBillingRecords } from "@/app/api/billing/route";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (session.role !== "OWNER") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (process.env.BILLING_ENABLED !== "true" || !prisma) return NextResponse.json({ error: "Billing is not enabled on this deployment." }, { status: 503 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured on this deployment." }, { status: 503 });

  try {
    const organization = await ensureBillingRecords(session.userId, session.name);
    const paymentCustomer = await prisma.paymentCustomer.findUnique({ where: { organizationId: organization.id }, select: { providerCustomerId: true } });
    if (!paymentCustomer) return NextResponse.json({ error: "No Stripe customer exists yet. Choose a plan first." }, { status: 409 });
    const portal = await stripe.billingPortal.sessions.create({ customer: paymentCustomer.providerCustomerId, return_url: `${new URL(request.url).origin}/billing` });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    console.error("[POST /api/billing/portal]", error);
    return NextResponse.json({ error: "Unable to open Stripe billing management." }, { status: 502 });
  }
}
