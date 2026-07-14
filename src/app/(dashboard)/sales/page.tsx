import { Header } from "@/components/layout/header";
import SalesDashboard from "@/components/sales/sales-dashboard";

export default function SalesPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">

      <Header
        title="Ticket Sales"
        subtitle="Scan lottery tickets to record sales"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <SalesDashboard />
      </div>

    </div>
  );
}