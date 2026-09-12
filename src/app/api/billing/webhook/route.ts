import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe, mapStripeSubscriptionStatus, stripeDate } from "@/lib/stripe";

async function organizationIdForCustomer(customerId: string) {
  if (!prisma) return null;
  const customer = await prisma.paymentCustomer.findUnique({ where: { providerCustomerId: customerId } });
  return customer?.organizationId ?? null;
}

async function syncSubscription(subscription: Stripe.Subscription, fallbackOrganizationId?: string | null) {
  if (!prisma) return;
  const organizationId = subscription.metadata.organizationId ?? fallbackOrganizationId ?? await organizationIdForCustomer(subscription.customer as string);
  if (!organizationId) return;

  const subscriptionItem = subscription.items.data[0];
  const priceId = subscriptionItem?.price.id;
  const plan = priceId ? await prisma.plan.findFirst({ where: { providerPriceId: priceId, active: true } }) : null;
  if (!plan) return;

  const data = {
    planId: plan.id,
    providerSubscriptionId: subscription.id,
    status: mapStripeSubscriptionStatus(subscription.status),
    trialEndsAt: stripeDate(subscription.trial_end),
    currentPeriodStart: stripeDate(subscriptionItem?.current_period_start),
    currentPeriodEnd: stripeDate(subscriptionItem?.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };

  await prisma.subscription.upsert({
    where: { organizationId },
    update: data,
    create: { organizationId, ...data },
  });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret || !prisma) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const existing = await prisma.paymentEvent.findUnique({ where: { providerEventId: event.id } });
  if (existing) return NextResponse.json({ received: true, duplicate: true });

  let organizationId: string | null = null;
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkout = event.data.object as Stripe.Checkout.Session;
        organizationId = checkout.metadata?.organizationId ?? null;
        if (checkout.subscription) {
          const subscription = await stripe.subscriptions.retrieve(checkout.subscription as string);
          await syncSubscription(subscription, organizationId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        organizationId = subscription.metadata.organizationId ?? await organizationIdForCustomer(subscription.customer as string);
        await syncSubscription(subscription, organizationId);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        organizationId = await organizationIdForCustomer(invoice.customer as string);
        const invoiceSubscription = invoice.parent?.subscription_details?.subscription;
        if (invoiceSubscription) {
          const subscription = await stripe.subscriptions.retrieve(invoiceSubscription as string);
          await syncSubscription(subscription, organizationId);
        }
        break;
      }
      default:
        break;
    }

    await prisma.paymentEvent.create({
      data: {
        providerEventId: event.id,
        eventType: event.type,
        organizationId,
        payload: JSON.parse(JSON.stringify(event)),
        processedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[POST /api/billing/webhook]", error);
    return NextResponse.json({ error: "Unable to process Stripe event." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
