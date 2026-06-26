import { Header } from "@/components/layout/header";
import { ReceiveScanSession } from "@/components/inventory/receive-scan-session";

export default function ReceiveInventoryPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Receive inventory"
        subtitle="Log a new pack from the supplier into back stock"
      />
      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        <ReceiveScanSession />
      </div>
    </div>
  );
}
