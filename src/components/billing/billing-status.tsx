"use client";

import Link from "next/link";
import { CreditCard } from "lucide-react";
import { useEffect, useState } from "react";

interface BillingState {
  subscription?: { status: string; plan?: { name: string } } | null;
}

const statusLabel: Record<string, string> = {
  ACTIVE: "Active",
  TRIALING: "Trial",
  PAST_DUE: "Payment issue",
  CANCELED: "Canceled",
  INCOMPLETE: "Setup required",
};

export function BillingStatus() {
  const [state, setState] = useState<BillingState | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/billing", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<BillingState>;
      })
      .then((data) => {
        if (active && data) setState(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!state) return null;

  const subscription = state.subscription;
  const status = subscription?.status ?? "INCOMPLETE";
  const label = statusLabel[status] ?? "Billing";
  const plan = subscription?.plan?.name ?? "Choose a plan";
  const isAttention = ["PAST_DUE", "CANCELED", "INCOMPLETE"].includes(status);

  return (
    <Link
      href="/billing"
      className={`inline-flex min-h-9 items-center gap-2 border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        isAttention
          ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
          : "border-white/20 bg-white/10 text-white hover:bg-white/15"
      }`}
      title="Manage billing"
    >
      <CreditCard size={14} />
      <span className="hidden sm:inline">{plan} · {label}</span>
      <span className="sm:hidden">{label}</span>
    </Link>
  );
}
