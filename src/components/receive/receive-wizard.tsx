"use client";

import { useState } from "react";

import type { PackWithGame, ShipmentState } from "@/lib/types";

import { ProgressStepper } from "./progress-stepper";
import { InvoiceStep } from "./steps/invoice-step";
import { ScanStep } from "./steps/scan-step";
import { ReviewStep } from "./steps/review-step";
import { ConfirmStep } from "./steps/confirm-step";

export type WizardStep = 1 | 2 | 3 | 4;

interface ScanDraftState {
  barcode: string;
  gameNumber: string;
  packNumber: string;
  firstTicket: string;
  ticketPrice: number;
  ticketQuantity: number;
  packImage: string;
}

export default function ReceiveWizard() {
  const [step, setStep] = useState<WizardStep>(1);

const [shipment, setShipment] = useState<ShipmentState>({
  id: "",
  invoiceNumber: "",
  invoicePhoto: "",
  shipmentDate: new Date().toISOString().split("T")[0],
  receivedBy: "",
  expectedPacks: 0,
  expectedRetailValue: 0,
  scannedPacks: 0,
  status: "IN_PROGRESS",
});

  const [packs, setPacks] = useState<PackWithGame[]>([]);
  const [scanDraft, setScanDraft] = useState<ScanDraftState>({
    barcode: "",
    gameNumber: "",
    packNumber: "",
    firstTicket: "",
    ticketPrice: 10,
    ticketQuantity: 50,
    packImage: "",
  });

  function nextStep() {
    if (step < 4) {
      setStep((prev) => (prev + 1) as WizardStep);
    }
  }

  function previousStep() {
    if (step > 1) {
      setStep((prev) => (prev - 1) as WizardStep);
    }
  }

  function addPack(pack: PackWithGame) {
    setPacks((prev) => [...prev, pack]);

    setShipment((prev) => ({
      ...prev,
      scannedPacks: (prev.scannedPacks ?? 0) + 1,
    }));
  }

  function removePack(id: string) {
    setPacks((prev) => prev.filter((p) => p.id !== id));

    setShipment((prev) => ({
      ...prev,
      scannedPacks: Math.max((prev.scannedPacks ?? 1) - 1, 0),
    }));
  }

  function updatePack(updatedPack: PackWithGame) {
    setPacks((prev) =>
      prev.map((pack) => (pack.id === updatedPack.id ? updatedPack : pack))
    );
  }

  return (
    <div className="space-y-6">
      <ProgressStepper currentStep={step} />

      {step === 1 && (
        <InvoiceStep
          shipment={shipment}
          setShipment={setShipment}
          nextStep={nextStep}
        />
      )}

      {step === 2 && (
        <ScanStep
          shipment={shipment}
          setShipment={setShipment}
          packs={packs}
          scanDraft={scanDraft}
          setScanDraft={setScanDraft}
          addPack={addPack}
          removePack={removePack}
          nextStep={nextStep}
          previousStep={previousStep}
        />
      )}

      {step === 3 && (
        <ReviewStep
          shipment={shipment}
          packs={packs}
          updatePack={updatePack}
          nextStep={nextStep}
          previousStep={previousStep}
        />
      )}

      {step === 4 && (
        <ConfirmStep
          shipment={shipment}
          packs={packs}
          previousStep={previousStep}
        />
      )}
    </div>
  );
}