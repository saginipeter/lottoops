"use client";

import { useState } from "react";
import { Calendar, Camera, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { InlineGuidance } from "@/components/ui/inline-guidance";
import { InvoiceUpload } from "../invoice-upload";
import type { ShipmentState } from "@/lib/types";

interface InvoiceStepProps {
  shipment: ShipmentState;
  setShipment: React.Dispatch<React.SetStateAction<ShipmentState>>;
  nextStep: () => void;
  onCancel: () => void;
}

export function InvoiceStep({ shipment, setShipment, nextStep, onCancel }: InvoiceStepProps) {
  const [attemptedContinue, setAttemptedContinue] = useState(false);

  const missing = {
    invoiceNumber: !shipment.invoiceNumber?.trim(),
    invoicePhoto: !shipment.invoicePhoto,
    confirmationNumber: !shipment.shipmentConfirmationNumber?.trim(),
    confirmationPhoto: !shipment.confirmationReceiptPhoto,
    expectedPacks: !shipment.expectedPacks || shipment.expectedPacks <= 0,
    inventoryCost: !shipment.expectedRetailValue || shipment.expectedRetailValue <= 0,
  };

  async function handleContinue() {
    setAttemptedContinue(true);
    if (missing.invoiceNumber) return alert("Please enter an invoice tracking number.");
    if (missing.invoicePhoto) return alert("Please upload an invoice photo.");
    if (missing.confirmationNumber) return alert("Please enter a shipment confirmation number.");
    if (missing.confirmationPhoto) return alert("Please upload a confirmation receipt photo.");
    if (missing.expectedPacks) return alert("Expected packs must be greater than zero.");
    if (missing.inventoryCost) return alert("Enter the expected inventory cost before continuing.");
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
          expectedRetailValue: shipment.expectedRetailValue,
          supplierName: shipment.supplierName,
          supplierDetails: shipment.supplierDetails,
        }),
      });
      const data = await response.json();
      if (!response.ok) return alert(data.error || "Unable to create shipment.");
      setShipment((prev) => ({
        ...prev,
        id: data.id ?? prev.id,
        receivedBy: data.receivedBy?.name ?? prev.receivedBy,
        supplierName: data.supplierName ?? "",
        supplierDetails: data.supplierDetails ?? "",
        expectedRetailValue: data.expectedInventoryCost == null ? prev.expectedRetailValue : Number(data.expectedInventoryCost),
        scannedPacks: Number(data.existingPackCount ?? data.scannedPacks ?? prev.scannedPacks ?? 0),
        status: data.status ?? prev.status,
      }));
      nextStep();
    } catch (error) {
      console.error(error);
      alert("Unable to create shipment.");
    }
  }

  return <>
    <InlineGuidance title="Step 1 · Shipment Details">
      Enter the invoice, order date, and shipment details. Upload clear photos of the invoice and confirmation receipt; required entries will be marked in red if they are missing.
    </InlineGuidance>
    <Panel className="p-4 sm:p-5">
      <div className="mb-4 border-b border-border pb-3">
        <h2 className="text-lg font-semibold text-text">Shipment details</h2>
        <p className="mt-1 text-xs text-text-secondary">Enter the shipment information and attach both required photos.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Invoice tracking number" icon={<FileText size={15} />} required missing={attemptedContinue && missing.invoiceNumber}>
          <input inputMode="numeric" aria-invalid={attemptedContinue && missing.invoiceNumber} className={inputClass(attemptedContinue && missing.invoiceNumber)} value={shipment.invoiceNumber ?? ""} onChange={(e) => setShipment((prev) => ({ ...prev, invoiceNumber: e.target.value }))} placeholder="Enter invoice number" />
        </Field>
        <Field label="Order Date" icon={<Calendar size={15} />}>
          <input type="date" className={inputClass(false)} value={shipment.shipmentDate ?? ""} onChange={(e) => setShipment((prev) => ({ ...prev, shipmentDate: e.target.value }))} />
        </Field>
        <Field label="Confirmation number" icon={<FileText size={15} />} hint="Different from invoice number" required missing={attemptedContinue && missing.confirmationNumber}>
          <input inputMode="numeric" aria-invalid={attemptedContinue && missing.confirmationNumber} className={inputClass(attemptedContinue && missing.confirmationNumber)} value={shipment.shipmentConfirmationNumber ?? ""} onChange={(e) => setShipment((prev) => ({ ...prev, shipmentConfirmationNumber: e.target.value }))} placeholder="Enter confirmation number" />
        </Field>
        <Field label="Expected packs" icon={<Package size={15} />} required missing={attemptedContinue && missing.expectedPacks}>
          <input type="number" onWheel={(event) => event.currentTarget.blur()} inputMode="numeric" min="1" aria-invalid={attemptedContinue && missing.expectedPacks} className={inputClass(attemptedContinue && missing.expectedPacks)} value={shipment.expectedPacks ?? 0} onChange={(e) => setShipment((prev) => ({ ...prev, expectedPacks: Number(e.target.value) }))} />
        </Field>
        <Field label="Expected inventory cost" icon={<Package size={15} />} hint="Enter the amount paid upfront. It will be checked against 95% of face value after scanning." required missing={attemptedContinue && missing.inventoryCost}>
          <div className="relative"><span className="absolute left-3 top-3 text-sm text-text-tertiary">$</span><input type="number" onWheel={(event) => event.currentTarget.blur()} inputMode="decimal" min="0" step="0.01" aria-invalid={attemptedContinue && missing.inventoryCost} className={`${inputClass(attemptedContinue && missing.inventoryCost)} pl-7`} value={shipment.expectedRetailValue ?? ""} onChange={(e) => setShipment((prev) => ({ ...prev, expectedRetailValue: e.target.value === "" ? undefined : Number(e.target.value) }))} placeholder="Enter inventory cost" /></div>
        </Field>
        <Field label="Received by" icon={<FileText size={15} />} hint="Automatically identified from your signed-in account.">
          <input readOnly className="h-11 w-full border border-border bg-muted/20 px-3 text-sm text-text-secondary" value={shipment.receivedBy || ""} />
        </Field>
        <Field label="Supplier name (optional)" icon={<FileText size={15} />}>
          <input maxLength={200} className={inputClass(false)} value={shipment.supplierName ?? ""} onChange={(e) => setShipment((prev) => ({ ...prev, supplierName: e.target.value }))} placeholder="Supplier name" />
        </Field>
        <Field label="Supplier details (optional)" icon={<FileText size={15} />}>
          <textarea maxLength={2000} className="min-h-20 w-full border border-border bg-muted/20 px-3 py-2 text-sm outline-none focus:border-accent" value={shipment.supplierDetails ?? ""} onChange={(e) => setShipment((prev) => ({ ...prev, supplierDetails: e.target.value }))} placeholder="Address, contact, or reference details" />
        </Field>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <UploadField label="Invoice photo" value={shipment.invoicePhoto ?? ""} title="Upload invoice photo" previewAlt="Invoice photo" missing={attemptedContinue && missing.invoicePhoto} onChange={(url) => setShipment((prev) => ({ ...prev, invoicePhoto: url }))} />
        <UploadField label="Confirmation receipt photo" value={shipment.confirmationReceiptPhoto ?? ""} title="Upload confirmation receipt" previewAlt="Confirmation receipt photo" missing={attemptedContinue && missing.confirmationPhoto} onChange={(url) => setShipment((prev) => ({ ...prev, confirmationReceiptPhoto: url }))} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" className="w-full" onClick={onCancel}>Cancel</Button>
        <Button className="w-full" onClick={handleContinue}>Continue to scan packs →</Button>
      </div>
    </Panel>
  </>;
}

function inputClass(missing: boolean) {
  return `h-11 w-full border px-3 text-sm outline-none focus:border-accent ${missing ? "border-red-600 bg-red-50 ring-1 ring-red-300" : "border-border bg-muted/20"}`;
}

function Field({ label, icon, hint, required = false, missing = false, children }: { label: string; icon: React.ReactNode; hint?: string; required?: boolean; missing?: boolean; children: React.ReactNode }) {
  return <label className="block">
    <span className={`mb-1.5 flex items-center gap-2 text-xs font-semibold ${missing ? "text-red-800" : "text-text"}`}>
      <span className={missing ? "text-red-600" : "text-accent"}>{icon}</span>{label}{required && <span className="text-red-600" aria-hidden="true">*</span>}
    </span>
    {children}
    {missing && <span className="mt-1 block text-[10px] font-semibold text-red-700">Required — please complete this entry.</span>}
    {hint && <span className="mt-1 block text-[10px] text-text-tertiary">{hint}</span>}
  </label>;
}

function UploadField({ label, value, title, previewAlt, missing = false, onChange }: { label: string; value: string; title: string; previewAlt: string; missing?: boolean; onChange: (url: string) => void }) {
  return <div className={`border bg-muted/10 p-3 ${missing ? "border-2 border-red-600" : "border-border"}`}>
    <p className={`mb-2 flex items-center gap-2 text-xs font-semibold ${missing ? "text-red-800" : "text-text"}`}><Camera size={14} className={missing ? "text-red-600" : "text-accent"} />{label}<span className="text-red-600" aria-hidden="true">*</span></p>
    <InvoiceUpload value={value} title={title} previewAlt={previewAlt} compact onChange={onChange} />
    {missing && <p className="mt-2 text-[10px] font-semibold text-red-700">Required — upload a clear photo.</p>}
  </div>;
}
