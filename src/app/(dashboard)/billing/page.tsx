import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { BillingManager } from "@/components/billing/billing-manager";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "OWNER") redirect("/");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header title="Billing" subtitle="Owner subscription and plan management" />
      <PageToolbar
        left={<span className="text-xs text-text-secondary">Owner account</span>}
        center={<span>Plans and subscription</span>}
        right={<span className="text-xs text-text-tertiary">Stripe checkout</span>}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <BillingManager />
      </div>
      <StatusBar left={<span>Billing settings</span>} center={<span>Owner access only</span>} right={<span>Stripe billing</span>} />
    </div>
  );
}
