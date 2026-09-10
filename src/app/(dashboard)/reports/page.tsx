import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";
import { FinancialReports } from "@/components/reports/financial-reports";
import { InventoryStatusReport } from "@/components/reports/inventory-status-report";
import { ActivityReport } from "@/components/reports/activity-report";
import { DiscrepancyReport } from "@/components/reports/discrepancy-report";
import { CorrectionReport } from "@/components/reports/correction-report";
import { InventoryAgingReport } from "@/components/reports/inventory-aging-report";
import { ExceptionTrendsReport } from "@/components/reports/exception-trends-report";
import { AiDiscrepancyAnalysis } from "@/components/reports/ai-discrepancy-analysis";
import { WhatsAppSummaryCard } from "@/components/reports/whatsapp-summary-card";
import { StateReportsUploader } from "@/components/owner/state-reports-uploader";
import { LifecycleAnalyticsReport } from "@/components/reports/lifecycle-analytics-report";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title="Reports"
        subtitle="Financial, activity, and inventory status reports with export and print options"
      />

      <PageToolbar
        left={<span className="text-xs text-text-secondary">Scope: Current Store</span>}
        center={<span>Financial | Activity | Inventory</span>}
        right={<span className="text-xs text-text-tertiary">Use export controls inside reports</span>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-5">
          <FinancialReports />
          <ActivityReport />
          <DiscrepancyReport />
          {(session.role === "MANAGER" || session.role === "OWNER") && <CorrectionReport />}
          <InventoryStatusReport />
          <InventoryAgingReport />
          <LifecycleAnalyticsReport />
          <ExceptionTrendsReport />
          {(session.role === "MANAGER" || session.role === "OWNER") && <AiDiscrepancyAnalysis />}
          {(session.role === "MANAGER" || session.role === "OWNER") && <WhatsAppSummaryCard />}
          {session.role === "MANAGER" && <StateReportsUploader />}
        </div>
      </div>

      <StatusBar
        left={<span>Reports Ready</span>}
        center={<span>Refresh data before final export</span>}
        right={<span>Printed reports are audit artifacts</span>}
      />
    </div>
  );
}