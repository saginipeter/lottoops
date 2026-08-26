"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import type { PackWithGame, ShipmentState } from "@/lib/types";
import { Panel } from "@/components/ui/panel";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { Button } from "@/components/ui/button";

import { ProgressStepper } from "./progress-stepper";
import { InvoiceStep } from "./steps/invoice-step";
import { ScanStep } from "./steps/scan-step";
import { ReviewStep } from "./steps/review-step";
import { ConfirmStep } from "./steps/confirm-step";

export type WizardStep = 1 | 2 | 3 | 4;
const RECEIVE_DRAFT_KEY = "lottoops-receive-draft-v1";

interface ScanDraftState {
  barcode: string;
  gameNumber: string;
  packNumber: string;
  firstTicket: string;
  ticketPrice: number;
  ticketQuantity: number;
  packImage: string;
}

interface ReceiveWizardProps {
  initialStep?: WizardStep;
}

export default function ReceiveWizard({ initialStep = 1 }: ReceiveWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(initialStep);

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

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECEIVE_DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        step?: WizardStep;
        shipment?: ShipmentState;
        packs?: PackWithGame[];
        scanDraft?: ScanDraftState;
      };
      if (parsed.shipment) {
        setShipment(parsed.shipment);
      }
      if (parsed.packs && Array.isArray(parsed.packs)) {
        setPacks(parsed.packs);
      }
      if (parsed.scanDraft) {
        setScanDraft(parsed.scanDraft);
      }
    } catch (error) {
      console.error("Unable to restore receiving draft:", error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        RECEIVE_DRAFT_KEY,
        JSON.stringify({ step, shipment, packs, scanDraft })
      );
    } catch (error) {
      console.error("Unable to save receiving draft:", error);
    }
  }, [step, shipment, packs, scanDraft]);

  function nextStep() {
    if (step < 4) {
      const next = (step + 1) as WizardStep;
      setStep(next);
      router.push(`/inventory/receive/step/${next}`);
    }
  }

  function previousStep() {
    if (step > 1) {
      const previous = (step - 1) as WizardStep;
      setStep(previous);
      router.push(`/inventory/receive/step/${previous}`);
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

  function clearDraft() {
    try {
      window.localStorage.removeItem(RECEIVE_DRAFT_KEY);
    } catch (error) {
      console.error("Unable to clear receiving draft:", error);
    }
  }

  function clearFormData() {
    if (!window.confirm("Clear all receiving form data and scanned packs?")) return;

    setStep(1);
    setShipment({
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
    setPacks([]);
    setScanDraft({
      barcode: "",
      gameNumber: "",
      packNumber: "",
      firstTicket: "",
      ticketPrice: 10,
      ticketQuantity: 50,
      packImage: "",
    });
    clearDraft();
    router.push("/inventory/receive/step/1");
  }

  function cancelReceiving() {
    router.push("/inventory");
  }

  const expectedPacks = Number(shipment.expectedPacks ?? 0);
  const scannedPacks = Number(shipment.scannedPacks ?? 0);
  const completionPercent = expectedPacks > 0 ? Math.min(Math.round((scannedPacks / expectedPacks) * 100), 100) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageToolbar
        left={<span className="text-xs text-text-secondary">Invoice: {shipment.invoiceNumber || "Not set"}</span>}
        center={<span>Step {step} of 4</span>}
        right={
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">{shipment.status.replaceAll("_", " ")}</span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={clearFormData}
              className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              <Trash2 size={14} />
              Clear Form Data
            </Button>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <div className="grid h-full grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
          <Panel className="p-4">
            <h3 className="text-sm font-semibold text-text">Shipment Summary</h3>
            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-text-tertiary">Expected Packs</p>
                <p className="mt-1 text-lg font-semibold text-text">{expectedPacks}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-text-tertiary">Scanned Packs</p>
                <p className="mt-1 text-lg font-semibold text-text">{scannedPacks}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-text-tertiary">Completion</p>
                <p className="mt-1 text-lg font-semibold text-text">{completionPercent}%</p>
              </div>
            </div>
          </Panel>

          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <ProgressStepper currentStep={step} />

            {step === 1 && (
              <InvoiceStep
                shipment={shipment}
                setShipment={setShipment}
                nextStep={nextStep}
                onCancel={cancelReceiving}
              />
            )}

            {step === 2 && (
              <ScanStep
                shipment={shipment}
                packs={packs}
                scanDraft={scanDraft}
                setScanDraft={setScanDraft}
                addPack={addPack}
                removePack={removePack}
                nextStep={nextStep}
                previousStep={previousStep}
                onCancel={cancelReceiving}
              />
            )}

            {step === 3 && (
              <ReviewStep
                shipment={shipment}
                packs={packs}
                updatePack={updatePack}
                nextStep={nextStep}
                previousStep={previousStep}
                onCancel={cancelReceiving}
              />
            )}

            {step === 4 && (
              <ConfirmStep
                shipment={shipment}
                packs={packs}
                previousStep={previousStep}
                onConfirmed={clearDraft}
                onCancel={cancelReceiving}
              />
            )}
          </div>
        </div>
      </div>

      <StatusBar
        left={<span>Invoice Date: {shipment.shipmentDate || "Not set"}</span>}
        center={<span>Scanned: {scannedPacks} / {expectedPacks || 0}</span>}
        right={<span>{packs.length} packs in draft</span>}
      />
    </div>
  );
}