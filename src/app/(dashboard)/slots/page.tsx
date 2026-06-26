import { Header } from "@/components/layout/header";
import { SlotsManager } from "@/components/slots/slots-manager";

export default function SlotsPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Display slots"
        subtitle="Activate back stock packs to the TV display board"
      />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <SlotsManager />
      </div>
    </div>
  );
}