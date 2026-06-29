"use client";

import { useState } from "react";

import { MOCK_PACKS, MOCK_SHIPMENT, ShipmentPack } from "@/data/mock-shipment";

import { ProgressStepper } from "./progress-stepper";

import { InvoiceStep } from "./steps/invoice-step";
import { ScanStep } from "./steps/scan-step";
import { ReviewStep } from "./steps/review-step";
import { ConfirmStep } from "./steps/confirm-step";

export type WizardStep = 1 | 2 | 3 | 4;

export default function ReceiveWizard() {
  const [step, setStep] = useState<WizardStep>(1);

  const [shipment, setShipment] = useState({
    invoiceNumber: MOCK_SHIPMENT.invoiceNumber,
    invoicePhoto: MOCK_SHIPMENT.invoicePhoto,
    shipmentDate: MOCK_SHIPMENT.shipmentDate,
    receivedBy: MOCK_SHIPMENT.receivedBy,
    expectedPacks: MOCK_SHIPMENT.expectedPacks,
    scannedPacks: MOCK_SHIPMENT.scannedPacks,
    status: MOCK_SHIPMENT.status,
  });

  const [packs, setPacks] = useState<ShipmentPack[]>(MOCK_PACKS);

  function nextStep() {
    if (step < 4) {
      setStep((step + 1) as WizardStep);
    }
  }

  function previousStep() {
    if (step > 1) {
      setStep((step - 1) as WizardStep);
    }
  }

  function addPack(pack: ShipmentPack) {
    setPacks((prev) => [...prev, pack]);

    setShipment((prev) => ({
      ...prev,
      scannedPacks: prev.scannedPacks + 1,
    }));
  }

  function removePack(id: string) {
    setPacks((prev) => prev.filter((p) => p.id !== id));

    setShipment((prev) => ({
      ...prev,
      scannedPacks: Math.max(prev.scannedPacks - 1, 0),
    }));
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
          packs={packs}
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