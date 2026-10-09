"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2, Save } from "lucide-react";
import { Panel } from "@/components/ui/panel";

interface Plan { id: string; key: string; name: string; description: string; monthlyPriceCents: number; features: string[] }
interface Account { id: string; name: string; owner: { name: string; email: string }; stores: { id: string; name: string }[]; subscription: { id: string; status: string; plan: Plan } | null }
const statuses = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "INCOMPLETE"];

export function PlatformSubscriptionPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { planId: string; status: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true); setError("");
      const response = await fetch("/api/platform/subscriptions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load subscriptions.");
      setPlans(data.plans ?? []); setAccounts(data.accounts ?? []);
      const defaultPlanId = data.plans?.[0]?.id ?? "";
      setDrafts(Object.fromEntries((data.accounts ?? []).map((item: Account) => [item.id, { planId: item.subscription?.plan.id ?? defaultPlanId, status: item.subscription?.status ?? "TRIALING" }])));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load subscriptions."); } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  async function save(organizationId: string) {
    const draft = drafts[organizationId]; if (!draft) return;
    try { setSaving(organizationId); setMessage(""); setError(""); const response = await fetch("/api/platform/subscriptions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, ...draft }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to update subscription."); setMessage("Subscription access updated."); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update subscription."); } finally { setSaving(null); }
  }

  return <Panel className="p-5"><div className="flex items-start gap-2"><CreditCard size={18} className="mt-0.5 text-accent" /><div><h3 className="text-base font-semibold text-text">Subscription tiers and access</h3><p className="mt-1 text-sm text-text-secondary">Assign a plan and service state to each customer organization. Stripe remains the billing source of truth for paid subscriptions.</p></div></div>{message && <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}{error && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}{loading ? <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={15} className="animate-spin" /> Loading subscriptions...</div> : accounts.length === 0 ? <p className="mt-4 text-sm text-text-secondary">No customer organizations have been created yet.</p> : <div className="mt-4 space-y-3">{accounts.map((account) => { const draft = drafts[account.id] ?? { planId: account.subscription?.plan.id ?? plans[0]?.id ?? "", status: account.subscription?.status ?? "TRIALING" }; return <div key={account.id} className="grid gap-3 border border-border bg-surface p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end"><div><p className="font-semibold text-text">{account.name}</p><p className="text-xs text-text-secondary">{account.owner.name} · {account.owner.email}</p><p className="mt-1 text-xs text-text-tertiary">{account.stores.length} store(s) · {account.subscription ? "Subscription exists" : "No plan assigned"}</p></div><label className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Plan<select value={draft.planId} onChange={(event) => setDrafts((current) => ({ ...current, [account.id]: { ...draft, planId: event.target.value } }))} className="mt-1 min-h-10 w-full border border-border bg-white px-2 text-sm font-semibold text-text">{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · ${(plan.monthlyPriceCents / 100).toFixed(2)}/mo</option>)}</select></label><label className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Access status<select value={draft.status} onChange={(event) => setDrafts((current) => ({ ...current, [account.id]: { ...draft, status: event.target.value } }))} className="mt-1 min-h-10 w-full border border-border bg-white px-2 text-sm font-semibold text-text">{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label><button type="button" onClick={() => { void save(account.id); }} disabled={saving === account.id || !draft.planId} className="inline-flex min-h-10 items-center justify-center gap-2 bg-accent px-3 text-sm font-semibold text-white disabled:opacity-60">{saving === account.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save</button></div>; })}</div>}</Panel>;
}
