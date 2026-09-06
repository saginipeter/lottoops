import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { SupportTicketsPanel } from "@/components/support/support-tickets-panel";
import { getSession } from "@/lib/get-session";

export default async function SupportPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header title="Support" subtitle="Submit and track LottoOps support requests" />
      <PageToolbar
        left={<span className="text-xs text-text-secondary">Store: {session.storeName}</span>}
        center={<span>Account, setup, scanner, and software support</span>}
        right={<span className="text-xs text-text-tertiary">Support queue</span>}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
        <SupportTicketsPanel />
      </div>
      <StatusBar left={<span>Support</span>} center={<span>Requests are tracked for follow-up</span>} right={<span>Store scoped</span>} />
    </div>
  );
}
