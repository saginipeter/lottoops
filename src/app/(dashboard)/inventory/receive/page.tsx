import Link from "next/link";
import { ClipboardList, FileText, ScanLine, SearchCheck, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/get-session";
import { canReceiveShipments } from "@/lib/permissions";

const steps = [
  { number: "01", label: "Invoice", description: "Enter shipment details", icon: FileText, tone: "bg-[#079bd0]" },
  { number: "02", label: "Scan", description: "Scan every pack barcode", icon: ScanLine, tone: "bg-[#11a62b]" },
  { number: "03", label: "Review", description: "Check packs and cost", icon: SearchCheck, tone: "bg-[#ed7b0a]" },
  { number: "04", label: "Confirm", description: "Complete inventory receipt", icon: CheckCircle2, tone: "bg-[#e4142b]" },
];

export default async function ReceiveInventoryPage() {
  const session = await getSession();
  const permitted = Boolean(session && canReceiveShipments(session));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header title="Receive Stock" subtitle="Four simple steps · Keep the main screen clear" />
      <PageToolbar left={<span className="text-xs text-text-secondary">Inventory intake</span>} center={<span className="hidden sm:inline">See → Tap → Complete</span>} right={<span className="text-xs font-semibold text-text-tertiary">{permitted ? "Ready to receive" : "Permission required"}</span>} />
      <main className="min-h-0 flex-1 overflow-y-auto bg-bg px-4 py-5 sm:px-6 lg:overflow-hidden lg:py-8">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col justify-center">
          <div className="mb-6 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-tertiary">POS stock intake</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-text sm:text-4xl">Receive a new shipment</h1><p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">Start the guided receiving workflow. Each step opens only when the previous step is complete.</p></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {steps.map((step) => { const Icon = step.icon; return <div key={step.number} className={`min-h-[150px] border p-4 text-white shadow-[0_3px_0_rgba(0,0,0,0.12)] sm:min-h-[180px] sm:p-5 ${step.tone}`}><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center bg-white/20 text-white"><Icon size={25} /></span><span className="text-2xl font-black text-white/70">{step.number}</span></div><div className="mt-5"><h2 className="text-lg font-bold">{step.label}</h2><p className="mt-1 text-xs text-white/80 sm:text-sm">{step.description}</p></div></div>; })}
          </div>
          <Panel className="mx-auto mt-6 w-full max-w-2xl border-2 border-[#cbd5e1] bg-white p-5 text-center shadow-[0_10px_28px_rgba(23,35,63,0.08)] sm:p-7"><ClipboardList className="mx-auto text-[#314a8a]" size={30} /><h2 className="mt-3 text-xl font-bold text-text">Ready to begin?</h2><p className="mt-1 text-sm text-text-secondary">The existing receiving workflow will open in a focused step-by-step screen.</p><Link href="/inventory/receive/step/1" className="mt-5 block"><Button disabled={!permitted} className="min-h-14 w-full bg-[#314a8a] text-lg font-bold">Start Receiving Shipment</Button></Link>{!permitted && <p className="mt-3 text-xs font-semibold text-amber-700">Your role does not have permission to receive shipments.</p>}</Panel>
        </div>
      </main>
    </div>
  );
}
