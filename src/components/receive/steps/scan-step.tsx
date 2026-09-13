"use client";

import { useState, useCallback } from "react";

import type { PackWithGame, ShipmentState } from "@/lib/types";
import { parseBarcode } from "@/lib/barcode";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

import { BarcodeScanner } from "../barcode-scanner";
import { TicketPriceOnly } from "../ticket-price-only";
import { InvoiceUpload } from "../invoice-upload";
import { ScannedPackTable } from "../scanned-pack-table";
import { getSuggestedTicketQuantity } from "@/lib/ticket-quantity";

interface DetectedGame {
  source: "store" | "catalog";
  name: string;
  price: number;
  ticketsPerPack: number;
}

interface ScanStepProps {
  shipment: ShipmentState;
  packs: PackWithGame[];
  scanDraft: {
    barcode: string;
    gameNumber: string;
    packNumber: string;
    firstTicket: string;
    ticketPrice: number;
    ticketQuantity: number;
    packImage: string;
  };
  setScanDraft: React.Dispatch<
    React.SetStateAction<{
      barcode: string;
      gameNumber: string;
      packNumber: string;
      firstTicket: string;
      ticketPrice: number;
      ticketQuantity: number;
      packImage: string;
    }>
  >;
  addPack: (pack: PackWithGame) => void;
  removePack: (id: string) => void;
  nextStep: () => void;
  previousStep: () => void;
  onCancel: () => void;
}

export function ScanStep({
  shipment,
  packs,
  scanDraft,
  setScanDraft,
  addPack,
  removePack,
  nextStep,
  previousStep,
  onCancel,
}: ScanStepProps) {
  const {
    barcode,
    gameNumber,
    packNumber,
    firstTicket,
    ticketPrice,
    ticketQuantity,
    packImage,
  } = scanDraft;

  // Auto-detection state
  const [detecting, setDetecting] = useState(false);
  const [detectedGame, setDetectedGame] = useState<DetectedGame | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [quantityOverrideEnabled, setQuantityOverrideEnabled] = useState(false);
  const [manualOverrideEnabled, setManualOverrideEnabled] = useState(false);
  const expectedPacks = Number(shipment.expectedPacks ?? 0);
  const atExpectedLimit = expectedPacks > 0 && packs.length >= expectedPacks;

  // After a barcode is parsed, auto-detect the game
  const detectGame = useCallback(async (gn: string) => {
    if (!gn) return;
    setDetecting(true);
    setDetectedGame(null);
    setDetectionError(null);
    try {
      const res = await fetch(`/api/packs/detect-game?gameNumber=${encodeURIComponent(gn)}`);
      const data = await res.json();
      if (res.ok && data.found) {
        setDetectedGame(data as DetectedGame);
        setManualOverrideEnabled(false);
        const suggestedQuantity = getSuggestedTicketQuantity(Number(data.price));
        setScanDraft((prev) => ({
          ...prev,
          ticketPrice: data.price,
          ticketQuantity: suggestedQuantity,
        }));
      } else {
        setDetectionError("Game not found in catalog — please select price & quantity manually.");
        setManualOverrideEnabled(true);
      }
    } catch {
      setDetectionError("Could not reach server for auto-detect.");
    } finally {
      setDetecting(false);
    }
  }, [setScanDraft]);

  function handleScan(value: string) {
    const parsed = parseBarcode(value);
    setScanDraft((prev) => ({
      ...prev,
      barcode: value,
      gameNumber: parsed.gameNumber,
      packNumber: parsed.packNumber,
      firstTicket: parsed.firstTicket,
    }));
    setJustAdded(false);

    if (parsed.gameNumber) {
      detectGame(parsed.gameNumber);
    } else {
      setDetectedGame(null);
      setDetectionError(null);
      setManualOverrideEnabled(false);
    }
  }

  async function handleAddPack() {
    if (atExpectedLimit) {
      alert(`This shipment already reached expected packs (${expectedPacks}).`);
      return;
    }

    const cleanedBarcode = barcode.replace(/\D/g, "");
    const normalizedBarcode = cleanedBarcode.slice(0, 11);

    if (!gameNumber || !packNumber) return;
    if (normalizedBarcode.length < 11) {
      alert("Barcode must contain at least 11 digits for receiving.");
      return;
    }
    if (!/^\d{7}$/.test(packNumber)) { alert("Pack number must be exactly 7 digits."); return; }

    try {
      const response = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: shipment.id,
          barcode: normalizedBarcode,
          gameNumber,
          packNumber,
          firstTicket: Number(firstTicket),
          ticketPrice,
          ticketQuantity,
          packImage,
        }),
      });

      const savedPack = await response.json();
      if (!response.ok) { alert(savedPack.error); return; }

      addPack(savedPack);

      // Reset for next pack
      setScanDraft((prev) => ({
        ...prev,
        barcode: "",
        gameNumber: "",
        packNumber: "",
        firstTicket: "",
        packImage: "",
      }));
      setDetectedGame(null); setDetectionError(null);
      setJustAdded(true);
    } catch (err) {
      console.error(err);
      alert("Unable to save pack.");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">

        {/* Scan packs */}
        <Panel className="p-5">
          <h2 className="mb-5 text-xl font-semibold">Scan Pack</h2>
          <BarcodeScanner barcode={barcode} onChange={handleScan} />

          {/* Auto-detection result */}
          {gameNumber && (
            <div className="mt-4">
              {detecting && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  Detecting game from the Lottery Scratch_off Management System catalog…
                </div>
              )}
              {!detecting && detectedGame && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        ✓ Game Detected
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${detectedGame.source === "store" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {detectedGame.source === "store" ? "Store Catalog" : "Lottery Scratch_off Sync"}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-emerald-700 font-medium">{detectedGame.name}</p>
                      <p className="text-xs text-emerald-600">
                        ${detectedGame.price} ticket · {detectedGame.ticketsPerPack} tickets/pack
                      </p>
                    </div>
                    <button
                      className="text-xs text-emerald-500 hover:text-emerald-700 underline mt-0.5"
                      onClick={() => setManualOverrideEnabled(true)}
                    >
                      Override
                    </button>
                  </div>
                </div>
              )}
              {!detecting && detectionError && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                  ⚠ {detectionError}
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* Pack image */}
        <Panel className="p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Pack image</h3>
            <p className="text-sm text-gray-500">Upload a photo of the pack.</p>
          </div>
          <InvoiceUpload
            value={packImage}
            title="Upload Pack Image"
            previewAlt="Pack image"
            errorMessage="Failed to upload pack image."
            onChange={(url) =>
              setScanDraft((prev) => ({
                ...prev,
                packImage: url,
              }))
            }
          />
          <p className="mt-2 text-[11px] text-text-tertiary">Optional — add a photo only when the pack needs visual verification.</p>
          {packImage && <p className="mt-2 text-sm text-green-600">✓ Image uploaded</p>}
        </Panel>

        {/* Ticket price */}
        {(!detectedGame || manualOverrideEnabled) && <div className="relative">
          {detectedGame && (
            <div className="absolute right-6 top-5 z-10">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Auto-filled ✓
              </span>
            </div>
          )}
          <TicketPriceOnly
            selectedPrice={ticketPrice}
            onSelect={(value) =>
              setScanDraft((prev) => ({
                ...prev,
                ticketPrice: value,
              }))
            }
          />
        </div>}

        {(!detectedGame || manualOverrideEnabled) && <Panel className="p-5">
          <h3 className="text-lg font-semibold">Ticket Quantity</h3>
          <p className="mt-1 text-sm text-gray-500">The suggested quantity is used by default. Enable override for store testing.</p>
          <label className="mt-4 flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={quantityOverrideEnabled}
              onChange={(event) => {
                const enabled = event.target.checked;
                setQuantityOverrideEnabled(enabled);
                if (!enabled) {
                  setScanDraft((prev) => ({
                    ...prev,
                    ticketQuantity: getSuggestedTicketQuantity(prev.ticketPrice),
                  }));
                }
              }}
              className="h-4 w-4"
            />
            Override default ticket quantity
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={ticketQuantity}
            readOnly={!quantityOverrideEnabled}
            onChange={(event) => {
              const value = Number(event.target.value);
              setScanDraft((prev) => ({ ...prev, ticketQuantity: value }));
            }}
            className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-3 text-lg font-semibold"
          />
          <p className="mt-2 text-xs text-gray-500">Suggested for ${ticketPrice}: {getSuggestedTicketQuantity(ticketPrice)} tickets</p>
        </Panel>}

        {/* Add Pack */}
        <Panel className="p-5 lg:col-span-2">
          <Button className="w-full" onClick={handleAddPack} disabled={!gameNumber || !packNumber || atExpectedLimit}>
            Add Pack to Shipment
          </Button>
          {atExpectedLimit && (
            <p className="mt-3 text-sm font-medium text-amber-700">
              Expected pack limit reached. Continue to review/confirm.
            </p>
          )}
        </Panel>

        <div className="lg:col-span-2"><ScannedPackTable packs={packs} removePack={removePack} /></div>

        <div className="space-y-3 border-t border-border pt-4 lg:col-span-2">
          {justAdded && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {(shipment.expectedPacks ?? 0) > packs.length
                ? `Pack added. Scan the next pack (${packs.length}/${shipment.expectedPacks ?? 0}).`
                : "Pack added. Review the shipment details."}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Button variant="secondary" className="w-full" onClick={previousStep}>
              ← Back
            </Button>
            <Button variant="outline" className="w-full" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="w-full" onClick={nextStep} disabled={packs.length === 0}>
              Next: Review Shipment →
            </Button>
          </div>
        </div>
    </div>
  );
}
