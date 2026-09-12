"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface Plan {
  id: string;
  key: string;
  name: string;
  monthlyPriceCents: number;
  description: string;
  features: string[];
}

interface Subscription {
  status: string;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
}

export function BillingManager() {
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/billing", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "Unable to load billing."); return; }
      setBillingEnabled(data.billingEnabled === true);
      setPlans(data.plans ?? []);
      setSubscription(data.subscription ?? null);
      setOrganizationName(data.organization?.name ?? "Owner account");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function selectPlan(planId: string) {
    setSaving(planId);
    setMessage("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") { setMessage(data.error ?? "Unable to start checkout."); return; }
      window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "AbortError" ? "Checkout timed out. Please verify the Stripe and database environment variables, then try again." : "Unable to reach checkout. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      setSaving(null);
    }
  }

  if (loading) return <div className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Loading billing...</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Panel className="border-accent/30 bg-surface-soft p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{organizationName}</p><h2 className="mt-1 text-xl font-semibold text-text">Choose the plan for your Lottoops operation</h2><p className="mt-1 text-sm text-text-secondary">{billingEnabled ? "Select a plan to continue to secure Stripe checkout." : "Billing is in pilot mode. No payment is processed and plan changes are disabled until checkout is connected."}</p></div>
          <CreditCard className="text-accent" size={28} />
        </div>
        {subscription && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><CheckCircle2 size={16} /><span>Current plan: <strong>{subscription.plan.name}</strong></span><span>Status: <strong>{subscription.status}</strong></span>{subscription.trialEndsAt && <span>Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}</span>}</div>}
      </Panel>

      <section aria-labelledby="plans-heading"><div className="mb-3"><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Pricing and product access</p><h2 id="plans-heading" className="text-lg font-semibold text-text">Choose what your operation needs</h2></div><div className="grid grid-cols-1 gap-4 md:grid-cols-3">{plans.map((plan) => { const current = subscription?.plan.id === plan.id; return <Panel key={plan.id} className={`flex flex-col p-5 ${current ? "border-2 border-accent" : ""}`}><h3 className="text-lg font-semibold text-text">{plan.name}</h3><p className="mt-3 text-3xl font-bold text-text">${(plan.monthlyPriceCents / 100).toFixed(2)}<span className="text-sm font-normal text-text-secondary"> / month</span></p><p className="mt-2 min-h-10 text-sm text-text-secondary">{plan.description}</p><ul className="mt-4 space-y-2 text-sm text-text-secondary">{plan.features.map((feature) => <li key={feature} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />{feature}</li>)}</ul><Button className="mt-5 w-full" variant={current ? "secondary" : "default"} onClick={() => selectPlan(plan.id)} disabled={!billingEnabled || current || saving !== null}>{!billingEnabled ? "Pilot — checkout unavailable" : saving === plan.id ? "Saving..." : current ? "Current Plan" : "Choose Plan"}</Button></Panel>; })}</div></section>
      <Panel className="p-5"><h3 className="text-base font-semibold text-text">Payment and invoices</h3><p className="mt-1 text-sm text-text-secondary">Stripe securely handles payment methods and invoices. Subscription status is synchronized through signed webhooks.</p></Panel>
      {message && <p role="status" className="text-sm text-text-secondary">{message}</p>}
    </div>
  );
}
