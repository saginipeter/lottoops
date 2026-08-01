import { Header } from "@/components/layout/header";
import  ReceiveWizard from "@/components/receive/receive-wizard";

export default function ReceiveInventoryPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title="Receive Packs"
        subtitle="Receive lottery shipment and move packs into back stock"
      />

      <ReceiveWizard />
    </div>
  );
}