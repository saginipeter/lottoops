import { Header } from "@/components/layout/header";
import  ReceiveWizard from "@/components/receive/receive-wizard";

export default function ReceiveInventoryPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Receive Packs"
        subtitle="Receive lottery shipment and move packs into back stock"
      />

      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        <ReceiveWizard />
      </div>
    </div>
  );
}