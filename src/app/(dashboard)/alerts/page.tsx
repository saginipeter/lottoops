import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { TicketReportsPanel } from "@/components/reports/ticket-reports-panel";
import { TicketReturnRequestsPanel } from "@/components/reports/ticket-return-requests-panel";
import { getSession } from "@/lib/get-session";
import { isManagerOrAbove } from "@/lib/permissions";

export default async function AlertsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isManagerOrAbove(session)) redirect("/");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title="Alerts"
        subtitle="Employee-reported ticket exceptions requiring manager or owner review"
      />

      <PageToolbar
        left={<span className="text-xs text-text-secondary">Store scope: {session.role === "OWNER" ? "All Owned Stores" : session.storeName}</span>}
        center={<span>Resolve critical ticket issues quickly</span>}
        right={<span className="text-xs text-text-tertiary">Role: {session.role}</span>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <TicketReturnRequestsPanel
          title={session.role === "OWNER" ? "Ticket Return Requests Across Stores" : "Ticket Return Requests"}
        />
        <TicketReportsPanel
          title={session.role === "OWNER" ? "Employee Ticket Reports Across Stores" : "Employee Ticket Reports"}
        />
      </div>

      <StatusBar
        left={<span>Alert queue</span>}
        center={<span>Resolve items after validating ticket details</span>}
        right={<span>All actions are audited</span>}
      />
    </div>
  );
}
