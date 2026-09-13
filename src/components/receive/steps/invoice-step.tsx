"use client";

import Image from "next/image";
import { Calendar, Camera, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { InvoiceUpload } from "../invoice-upload";
import type { ShipmentState } from "@/lib/types";

interface InvoiceStepProps {
  shipment: ShipmentState;
  setShipment: React.Dispatch<React.SetStateAction<ShipmentState>>;
  nextStep: () => void;
  onCancel: () => void;
}

export function InvoiceStep({ shipment, setShipment, nextStep, onCancel }: InvoiceStepProps) {
  async function handleContinue() {
    if (!shipment.invoiceNumber?.trim()) return alert("Please enter an invoice tracking number.");
    if (!shipment.invoicePhoto) return alert("Please upload an invoice photo.");
    if (!shipment.shipmentConfirmationNumber?.trim()) return alert("Please enter a shipment confirmation number.");
    if (!shipment.confirmationReceiptPhoto) return alert("Please upload a confirmation receipt photo.");
    if (!shipment.expectedPacks || shipment.expectedPacks <= 0) return alert("Expected packs must be greater than zero.");
    if (!shipment.expectedRetailValue || shipment.expectedRetailValue <= 0) return alert("Expected invoice total value must be greater than zero.");

    try {
      const hasExistingShipment = Boolean(shipment.id);
      const response = await fetch("/api/shipments", {
        method: hasExistingShipment ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(hasExistingShipment ? { shipmentId: shipment.id } : {}),
          invoiceNumber: shipment.invoiceNumber,
          invoicePhoto: shipment.invoicePhoto,
          shipmentConfirmationNumber: shipment.shipmentConfirmationNumber,
          confirmationReceiptPhoto: shipment.confirmationReceiptPhoto,
          shipmentDate: shipment.shipmentDate,
          expectedPacks: shipment.expectedPacks,
        }),
      });
      const data = await response.json();
      if (!response.ok) return alert(data.error || "Unable to create shipment.");
      setShipment((prev) => ({ ...prev, id: data.id, scannedPacks: data.scannedPacks ?? prev.scannedPacks, status: data.status ?? prev.status }));
      nextStep();
    } catch (error) {
      console.error(error);
      alert("Unable to create shipment.");
    }
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <Panel className="p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-3">
          <div><h2 className="text-lg font-semibold text-text">Shipment details</h2><p className="mt-1 text-xs text-text-secondary">Enter the shipment information and attach both required photos.</p></div>
          <span className="shrink-0 border border-accent/30 bg-accent/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">Step 1</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Invoice tracking number" icon={<FileText size={15} />}>
            <input inputMode="numeric" className="h-11 w-full border border-border bg-muted/20 px-3 text-sm outline-none focus:border-accent" value={shipment.invoiceNumber ?? ""} onChange={(e) => setShipment((prev) => ({ ...prev, invoiceNumber: e.target.value }))} placeholder="Enter invoice number" />
          </Field>
          <Field label="Shipment date" icon={<Calendar size={15} />}>
            <input type="date" className="h-11 w-full border border-border bg-muted/20 px-3 text-sm outline-none focus:border-accent" value={shipment.shipmentDate ?? ""} onChange={(e) => setShipment((prev) => ({ ...prev, shipmentDate: e.target.value }))} />
          </Field>
          <Field label="Confirmation number" icon={<FileText size={15} />} hint="Different from invoice number">
            <input inputMode="numeric" className="h-11 w-full border border-border bg-muted/20 px-3 text-sm outline-none focus:border-accent" value={shipment.shipmentConfirmationNumber ?? ""} onChange={(e) => setShipment((prev) => ({ ...prev, shipmentConfirmationNumber: e.target.value }))} placeholder="Enter confirmation number" />
          </Field>
          <Field label="Expected packs" icon={<Package size={15} />}>
            <input type="number" inputMode="numeric" min="1" className="h-11 w-full border border-border bg-muted/20 px-3 text-sm outline-none focus:border-accent" value={shipment.expectedPacks ?? 0} onChange={(e) => setShipment((prev) => ({ ...prev, expectedPacks: Number(e.target.value) }))} />
          </Field>
          <Field label="Expected invoice total" icon={<Package size={15} />}>
            <div className="relative"><span className="absolute left-3 top-3 text-sm text-text-tertiary">$</span><input type="number" inputMode="decimal" min="0" step="0.01" className="h-11 w-full border border-border bg-muted/20 pl-7 pr-3 text-sm outline-none focus:border-accent" value={shipment.expectedRetailValue ?? 0} onChange={(e) => setShipment((prev) => ({ ...prev, expectedRetailValue: Number(e.target.value) }))} /></div>
          </Field>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <UploadField label="Invoice photo" value={shipment.invoicePhoto ?? ""} title="Upload invoice photo" previewAlt="Invoice photo" onChange={(url) => setShipment((prev) => ({ ...prev, invoicePhoto: url }))} />
          <UploadField label="Confirmation receipt photo" value={shipment.confirmationReceiptPhoto ?? ""} title="Upload confirmation receipt" previewAlt="Confirmation receipt photo" onChange={(url) => setShipment((prev) => ({ ...prev, confirmationReceiptPhoto: url }))} />
        </div>
      </Panel>

      <Panel className="flex flex-col p-4 sm:p-5">
        <div className="border-b border-border pb-3"><h3 className="text-base font-semibold text-text">Shipment summary</h3><p className="mt-1 text-xs text-text-secondary">Review before moving to pack scanning.</p></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
          <SummaryRow label="Invoice tracking #" value={shipment.invoiceNumber || "—"} />
          <SummaryRow label="Confirmation #" value={shipment.shipmentConfirmationNumber || "—"} />
          <SummaryRow label="Expected packs" value={String(shipment.expectedPacks ?? 0)} />
          <SummaryRow label="Invoice total" value={`$${Number(shipment.expectedRetailValue ?? 0).toFixed(2)}`} />
        </div>
        <div className="mt-4 flex-1"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">Receipt preview</p><div className="flex min-h-32 items-center justify-center border border-border bg-muted/20 p-2">{shipment.confirmationReceiptPhoto ? <Image src={shipment.confirmationReceiptPhoto} alt="Confirmation receipt" width={640} height={160} unoptimized className="max-h-40 w-full object-contain" /> : <div className="text-center text-text-tertiary"><Camera size={26} className="mx-auto mb-2 opacity-50" /><p className="text-xs">No receipt uploaded</p></div>}</div></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-1"><Button variant="outline" className="w-full" onClick={onCancel}>Cancel</Button><Button className="w-full" onClick={handleContinue}>Continue to scan packs →</Button></div>
      </Panel>
    </div>
  );
}

function Field({ label, icon, hint, children }: { label: string; icon: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-text"><span className="text-accent">{icon}</span>{label}</span>{children}{hint && <span className="mt-1 block text-[10px] text-text-tertiary">{hint}</span>}</label>;
}

function UploadField({ label, value, title, previewAlt, onChange }: { label: string; value: string; title: string; previewAlt: string; onChange: (url: string) => void }) {
  return <div className="border border-border bg-muted/10 p-3"><p className="mb-2 flex items-center gap-2 text-xs font-semibold text-text"><Camera size={14} className="text-accent" />{label}</p><InvoiceUpload value={value} title={title} previewAlt={previewAlt} compact onChange={onChange} /></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-10 items-center justify-between gap-3 border border-border bg-muted/20 px-3 py-2 text-xs"><span className="text-text-secondary">{label}</span><strong className="max-w-[60%] truncate text-right text-text">{value}</strong></div>;
}
