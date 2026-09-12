import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  stripeClient ??= new Stripe(secretKey, { timeout: 10_000, maxNetworkRetries: 1 });
  return stripeClient;
}

export function getStripePriceId(planKey: string) {
  const priceIds: Record<string, string | undefined> = {
    CORE: process.env.STRIPE_PRICE_CORE_MONTHLY,
    CONTROL: process.env.STRIPE_PRICE_CONTROL_MONTHLY,
    COMMAND: process.env.STRIPE_PRICE_COMMAND_MONTHLY,
  };
  return priceIds[planKey];
}

export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case "trialing": return "TRIALING" as const;
    case "active": return "ACTIVE" as const;
    case "past_due":
    case "unpaid": return "PAST_DUE" as const;
    case "canceled": return "CANCELED" as const;
    default: return "INCOMPLETE" as const;
  }
}

export function stripeDate(timestamp: number | null | undefined) {
  return timestamp ? new Date(timestamp * 1000) : null;
}
