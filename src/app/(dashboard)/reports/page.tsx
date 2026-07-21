import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";
import { FinancialReports } from "@/components/reports/financial-reports";
import { InventoryStatusReport } from "@/components/reports/inventory-status-report";
import { ActivityReport } from "@/components/reports/activity-report";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Reports"
        subtitle="Financial, activity, and inventory status reports with export and print options"
      />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-5">
          <FinancialReports />
          <ActivityReport />
          <InventoryStatusReport />
        </div>
      </div>
    </div>
  );
}