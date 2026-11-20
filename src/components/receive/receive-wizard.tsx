"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";

import type { PackWithGame, ShipmentState } from "@/lib/types";
import { isDraftPack } from "@/lib/receiving-draft";
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
  storeId: string;
  initialStep?: WizardStep;
  receiverName?: string;
}

interface ReceiveDraft {
  step?: WizardStep;
  shipment?: ShipmentState;
  packs?: PackWithGame[];
  scanDraft?: ScanDraftState;
}

function readReceiveDraft(draftKey: string): ReceiveDraft | null {
  if (typeof window === "undefined") return null;
  try {
    // Legacy drafts have no store identity and cannot be restored safely.
    window.localStorage.removeItem(RECEIVE_DRAFT_KEY);
    const raw = window.localStorage.getItem(draftKey);
    return raw ? (JSON.parse(raw) as ReceiveDraft) : null;
  } catch (error) {
    console.error("Unable to restore receiving draft:", error);
    return null;
  }
}

function createDefaultShipment(): ShipmentState {
  return {
    id: "",
    invoiceNumber: "",
    invoicePhoto: "",
    shipmentDate: new Date().toISOString().split("T")[0],
    receivedBy: "",
    expectedPacks: 0,
    expectedRetailValue: undefined,
    scannedPacks: 0,
    status: "IN_PROGRESS",
  };
}

const DEFAULT_SCAN_DRAFT: ScanDraftState = {
  barcode: "",
  gameNumber: "",
  packNumber: "",
  firstTicket: "",
  ticketPrice: 10,
  ticketQuantity: 50,
  packImage: "",
};

export default function ReceiveWizard(props: ReceiveWizardProps) {
  return <StoreReceiveWizard key={props.storeId} {...props} />;
}

function StoreReceiveWizard({ storeId, initialStep = 1, receiverName = "" }: ReceiveWizardProps) {
  const router = useRouter();
  const draftKey = `${RECEIVE_DRAFT_KEY}:${storeId}`;
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [syncedInitialStep, setSyncedInitialStep] = useState(initialStep);

  // Keep step in sync with the route-driven initialStep prop without an effect.
  if (initialStep !== syncedInitialStep) {
    setSyncedInitialStep(initialStep);
    setStep(initialStep);
  }

  const [shipment, setShipment] = useState<ShipmentState>(() => {
    return { ...createDefaultShipment(), receivedBy: receiverName };
  });

  const [packs, setPacks] = useState<PackWithGame[]>([]);

  const [scanDraft, setScanDraft] = useState<ScanDraftState>(DEFAULT_SCAN_DRAFT);
  const [overrideApproved, setOverrideApproved] = useState(false);

  useEffect(() => {
    if (draftLoaded) return;
    const draft = readReceiveDraft(draftKey);
    setStep(initialStep === 1 ? draft?.step ?? initialStep : initialStep);
    setShipment({ ...(draft?.shipment ?? createDefaultShipment()), receivedBy: receiverName });
    setPacks(Array.isArray(draft?.packs) ? draft.packs : []);
    setScanDraft(draft?.scanDraft ?? DEFAULT_SCAN_DRAFT);
    setDraftLoaded(true);
  }, [draftLoaded, draftKey, initialStep, receiverName]);

  useEffect(() => {
    if (!shipment.id) return;
    const controller = new AbortController();
    async function restoreShipmentMetadata() {
      try {
        const response = await fetch(`/api/shipments/${encodeURIComponent(shipment.id)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (controller.signal.aborted) return;
        setShipment((prev) => ({
          ...prev,
          receivedBy: data.receivedBy?.name ?? "",
          supplierName: prev.supplierName ?? data.supplierName ?? "",
          supplierDetails: prev.supplierDetails ?? data.supplierDetails ?? "",
          expectedRetailValue: prev.expectedRetailValue ?? (data.expectedInventoryCost == null ? undefined : Number(data.expectedInventoryCost)),
        }));
      } catch (error) {
        if (!controller.signal.aborted) console.error("Unable to restore shipment details:", error);
      }
    }
    void restoreShipmentMetadata();
    return () => controller.abort();
  }, [shipment.id]);

  useEffect(() => {
    const normalizedScannedCount = packs.length;
    if (Number(shipment.scannedPacks ?? 0) !== normalizedScannedCount) {
      setShipment((prev) => ({
        ...prev,
        scannedPacks: normalizedScannedCount,
      }));
    }
  }, [packs.length, shipment.scannedPacks]);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ step, shipment, packs, scanDraft })
      );
    } catch (error) {
      console.error("Unable to save receiving draft:", error);
    }
  }, [draftLoaded, draftKey, step, shipment, packs, scanDraft]);

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

  const [savingPacks, setSavingPacks] = useState(false);

  // Packs can be added to the shipment in selected batches or saved together
  // when the operator moves on to Review.
  async function persistDraftPacks(): Promise<boolean> {
    if (!shipment.id) {
      alert("Save the shipment details before reviewing it.");
      return false;
    }
    setSavingPacks(true);
    try {
      const syncResponse = await fetch("/api/packs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: shipment.id,
          keepPackIds: packs.filter((pack) => !isDraftPack(pack)).map((pack) => pack.id),
        }),
      });
      if (!syncResponse.ok) {
        const data = await syncResponse.json().catch(() => null);
        alert(data?.error || "Unable to sync removed packs with the server.");
        return false;
      }

      const draftPacks = packs.filter(isDraftPack);
      if (draftPacks.length > 0) {
        const response = await fetch("/api/packs/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shipmentId: shipment.id,
            packs: draftPacks.map((pack) => ({
              barcode: pack.serialNumber,
              gameNumber: pack.gameNumber,
              packNumber: pack.packNumber,
              firstTicket: pack.firstTicket,
              ticketPrice: Number(pack.ticketPrice),
              ticketQuantity: pack.ticketQuantity,
              packImage: pack.packImage || null,
            })),
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data?.packs) || data.packs.length !== draftPacks.length) {
          alert(data?.error || `Unable to save all scanned packs (HTTP ${response.status}).`);
          return false;
        }
        const savedByBarcode = new Map<string, PackWithGame>(
          (data.packs as PackWithGame[]).map((pack) => [pack.serialNumber, pack])
        );
        setPacks((prev) => prev.map((item) => {
          if (!isDraftPack(item)) return item;
          return savedByBarcode.get(item.serialNumber) ?? item;
        }));
      }
      return true;
    } catch (error) {
      console.error("Unable to save scanned packs:", error);
      alert("Unable to save scanned packs. Check the connection and try again.");
      return false;
    } finally {
      setSavingPacks(false);
    }
  }

  async function persistSelectedDraftPacks(packIds: string[]): Promise<{ success: boolean; message?: string }> {
    if (!shipment.id) return { success: false, message: "Save the shipment details before adding packs." };
    const selectedDrafts = packs.filter((pack) => isDraftPack(pack) && packIds.includes(pack.id));
    if (selectedDrafts.length === 0) return { success: false, message: "Select at least one scanned pack." };

    setSavingPacks(true);
    try {
      const response = await fetch("/api/packs/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: shipment.id,
          packs: selectedDrafts.map((pack) => ({
            barcode: pack.serialNumber,
            gameNumber: pack.gameNumber,
            packNumber: pack.packNumber,
            firstTicket: pack.firstTicket,
            ticketPrice: Number(pack.ticketPrice),
            ticketQuantity: pack.ticketQuantity,
            packImage: pack.packImage || null,
          })),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data?.packs) || data.packs.length !== selectedDrafts.length) {
        return { success: false, message: data?.error || `Unable to add selected packs (HTTP ${response.status}).` };
      }

      const savedByBarcode = new Map<string, PackWithGame>(
        (data.packs as PackWithGame[]).map((pack) => [pack.serialNumber, pack])
      );
      setPacks((prev) => prev.map((item) => savedByBarcode.get(item.serialNumber) ?? item));
      return { success: true };
    } catch (error) {
      console.error("Unable to add selected packs:", error);
      return { success: false, message: "Unable to reach the server. Scanned packs remain in the local draft; try again." };
    } finally {
      setSavingPacks(false);
    }
  }

  async function goToReview() {
    if (await persistDraftPacks()) {
      setStep(3);
      router.push("/inventory/receive/step/3");
    }
  }

  async function goToStep(targetStep: WizardStep) {
    if (targetStep > step + 1) return;
    if (step === 2 && targetStep === 3) {
      if (packs.length === 0) return;
      if (!(await persistDraftPacks())) return;
    }
    setStep(targetStep);
    router.push(`/inventory/receive/step/${targetStep}`);
  }

  function addPack(pack: PackWithGame) {
    setPacks((prev) => [...prev, pack]);

    setShipment((prev) => ({
      ...prev,
      scannedPacks: (prev.scannedPacks ?? 0) + 1,
    }));
  }

  async function removePack(id: string) {
    const pack = packs.find((item) => item.id === id);
    if (!pack) return;
    if (!isDraftPack(pack)) {
      const response = await fetch("/api/packs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: id, shipmentId: shipment.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to remove this pack from the shipment.");
    }
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
      window.localStorage.removeItem(draftKey);
    } catch (error) {
      console.error("Unable to clear receiving draft:", error);
    }
  }

  async function clearFormData() {
    if (!window.confirm("Clear all receiving form data and scanned packs?")) return;

    let serverWarning = "";

    if (shipment.id || shipment.invoiceNumber?.trim()) {
      try {
        const response = await fetch("/api/shipments", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shipmentId: shipment.id,
            invoiceNumber: shipment.invoiceNumber,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          serverWarning = data?.error || "Unable to clear the server shipment draft.";
        }
      } catch (error) {
        console.error("Unable to clear the server shipment draft:", error);
        serverWarning = "Unable to reach the server to clear the shipment draft.";
      }
    }

    // Always reset the local form, even if the server cleanup above failed,
    // so the wizard never gets stuck showing packs the user asked to clear.
    setStep(1);
    setShipment(createDefaultShipment());
    setPacks([]);
    setScanDraft(DEFAULT_SCAN_DRAFT);
    clearDraft();
    router.push("/inventory/receive/step/1");

    if (serverWarning) {
      window.alert(
        `Form cleared locally, but the server record couldn't be removed: ${serverWarning}`
      );
    }
  }

  async function cancelReceiving() {
    if (shipment.id || shipment.invoiceNumber?.trim()) {
      try {
        await fetch("/api/shipments", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shipmentId: shipment.id,
            invoiceNumber: shipment.invoiceNumber,
          }),
        });
      } catch (error) {
        console.error("Unable to clear canceled shipment draft:", error);
      }
    }
    clearDraft();
    router.push("/inventory");
  }

  const expectedPacks = Number(shipment.expectedPacks ?? 0);
  const scannedPacks = Number(shipment.scannedPacks ?? 0);

  if (!draftLoaded) return null;

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
              onClick={() => step > 1 ? previousStep() : router.push("/inventory")}
              className="font-bold"
            >
              <ArrowLeft size={14} />
              Back
            </Button>
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

      <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
        <div className="grid h-full grid-cols-1 gap-4">
          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <ProgressStepper currentStep={step} onStepClick={goToStep} />

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
                persistSelectedPacks={persistSelectedDraftPacks}
                nextStep={goToReview}
                savingPacks={savingPacks}
                previousStep={previousStep}
                onCancel={cancelReceiving}
              />
            )}

            {step === 3 && (
              <ReviewStep
                shipment={shipment}
                packs={packs}
                setShipment={setShipment}
                updatePack={updatePack}
                onOverrideApproved={() => setOverrideApproved(true)}
                overrideApproved={overrideApproved}
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
        left={<span>Order Date: {shipment.shipmentDate || "Not set"}</span>}
        center={<span>Scanned: {scannedPacks} / {expectedPacks || 0}</span>}
        right={<span>{packs.length} packs in draft</span>}
      />
    </div>
  );
}
