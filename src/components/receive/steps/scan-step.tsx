"use client";

import { useState, useEffect, useCallback } from "react";

import type { PackWithGame, ShipmentState } from "@/lib/types";
import { parseBarcode } from "@/lib/barcode";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

import { BarcodeScanner } from "../barcode-scanner";
import { TicketPriceOnly } from "../ticket-price-only";
import { TicketQuantityOnly } from "../ticket-quantity-only";
import { InvoiceUpload } from "../invoice-upload";
import { ShipmentSummary } from "../shipment-summary";
import { ScannedPackTable } from "../scanned-pack-table";

interface DetectedGame {
  source: "store" | "catalog";
  name: string;
  price: number;
  ticketsPerPack: number;
}

interface ScanStepProps {
  shipment: ShipmentState;
  setShipment: React.Dispatch<React.SetStateAction<ShipmentState>>;
  packs: PackWithGame[];
  addPack: (pack: PackWithGame) => void;
  removePack: (id: string) => void;
  nextStep: () => void;
  previousStep: () => void;
}

export function ScanStep({
  shipment,
  setShipment,
  packs,
  addPack,
  removePack,
  nextStep,
  previousStep,
}: ScanStepProps) {
  const [barcode, setBarcode] = useState("");
  const [gameNumber, setGameNumber] = useState("");
  const [packNumber, setPackNumber] = useState("");
  const [firstTicket, setFirstTicket] = useState("");

  const [ticketPrice, setTicketPrice] = useState(10);
  const [ticketQuantity, setTicketQuantity] = useState(50);
  const [packImage, setPackImage] = useState("");
  const [lotNumber, setLotNumber] = useState("");

  // Auto-detection state
  const [detecting, setDetecting] = useState(false);
  const [detectedGame, setDetectedGame] = useState<DetectedGame | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);

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
        setTicketPrice(data.price);
        setTicketQuantity(data.ticketsPerPack);
      } else {
        setDetectionError("Game not found in catalog — please select price & quantity manually.");
      }
    } catch {
      setDetectionError("Could not reach server for auto-detect.");
    } finally {
      setDetecting(false);
    }
  }, []);

  function handleScan(value: string) {
    setBarcode(value);
    const parsed = parseBarcode(value);
    setGameNumber(parsed.gameNumber);
    setPackNumber(parsed.packNumber);
    setFirstTicket(parsed.firstTicket);
  }

  // Trigger detection whenever gameNumber changes
  useEffect(() => {
    if (gameNumber) detectGame(gameNumber);
    else { setDetectedGame(null); setDetectionError(null); }
  }, [gameNumber, detectGame]);

  async function handleAddPack() {
    if (!gameNumber || !packNumber) return;
    if (!/^\d{7}$/.test(packNumber)) { alert("Pack number must be exactly 7 digits."); return; }
    if (!packImage) { alert("Please upload a pack image."); return; }

    try {
      const response = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: shipment.id,
          barcode,
          gameNumber,
          packNumber,
          firstTicket: Number(firstTicket),
          ticketPrice,
          ticketQuantity,
          packImage,
          lotNumber: lotNumber || undefined,
        }),
      });

      const savedPack = await response.json();
      if (!response.ok) { alert(savedPack.error); return; }

      addPack(savedPack);
      setShipment((prev) => ({ ...prev, scannedPacks: (prev.scannedPacks ?? 0) + 1 }));

      // Reset for next pack
      setBarcode(""); setGameNumber(""); setPackNumber(""); setFirstTicket("");
      setPackImage(""); setLotNumber("");
      setDetectedGame(null); setDetectionError(null);
    } catch (err) {
      console.error(err);
      alert("Unable to save pack.");
    }
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-6">

        {/* Step 5: Scan */}
        <Panel className="p-6">
          <h2 className="mb-5 text-xl font-semibold">Step 5: Scan Lottery Pack</h2>
          <BarcodeScanner barcode={barcode} onChange={handleScan} />

          <div className="mt-6 grid grid-cols-3 gap-4">
            <InfoCard label="Game #" value={gameNumber} />
            <InfoCard label="Pack #" value={packNumber} />
            <InfoCard label="First Ticket" value={firstTicket} />
          </div>

          {/* Auto-detection result */}
          {gameNumber && (
            <div className="mt-4">
              {detecting && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  Detecting game from Texas Lottery catalog…
                </div>
              )}
              {!detecting && detectedGame && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        ✓ Game Detected
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${detectedGame.source === "store" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {detectedGame.source === "store" ? "Store Catalog" : "TX Lottery Sync"}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-emerald-700 font-medium">{detectedGame.name}</p>
                      <p className="text-xs text-emerald-600">
                        ${detectedGame.price} ticket · {detectedGame.ticketsPerPack} tickets/pack
                      </p>
                    </div>
                    <button
                      className="text-xs text-emerald-500 hover:text-emerald-700 underline mt-0.5"
                      onClick={() => setDetectedGame(null)}
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

        {/* Step 6: Pack Image */}
        <Panel className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Step 6: Upload Pack Image</h3>
            <p className="text-sm text-gray-500">Upload a photo of the pack.</p>
          </div>
          <InvoiceUpload value={packImage} onChange={setPackImage} />
          {packImage && <p className="mt-3 text-sm text-green-600">✓ Image uploaded</p>}
        </Panel>

        {/* Step 7: Ticket Price — auto-filled, still editable */}
        <div className="relative">
          {detectedGame && (
            <div className="absolute right-6 top-5 z-10">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Auto-filled ✓
              </span>
            </div>
          )}
          <TicketPriceOnly selectedPrice={ticketPrice} onSelect={setTicketPrice} />
        </div>

        {/* Step 8: Ticket Quantity — auto-filled, still editable */}
        <div className="relative">
          {detectedGame && (
            <div className="absolute right-6 top-5 z-10">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Auto-filled ✓
              </span>
            </div>
          )}
          <TicketQuantityOnly
            selectedPrice={ticketPrice}
            selectedQuantity={ticketQuantity}
            onSelect={setTicketQuantity}
          />
        </div>

        {/* Lot Number */}
        <Panel className="p-6">
          <h3 className="text-lg font-semibold mb-2">Lot Number <span className="text-sm font-normal text-gray-500">(Optional)</span></h3>
          <input
            className="w-full rounded-lg border px-4 py-3"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            placeholder="Enter lot number if available"
          />
        </Panel>

        {/* Add Pack */}
        <Panel className="p-6">
          <Button className="w-full" onClick={handleAddPack} disabled={!gameNumber || !packNumber || !packImage}>
            Add Pack to Shipment
          </Button>
        </Panel>

        <ScannedPackTable packs={packs} removePack={removePack} />
      </div>

      <ShipmentSummary shipment={shipment} packs={packs}>
        <div className="space-y-3">
          <Button variant="secondary" className="w-full" onClick={previousStep}>← Back</Button>
          <Button className="w-full" onClick={nextStep} disabled={packs.length === 0}>Review Shipment →</Button>
        </div>
      </ShipmentSummary>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-soft p-4">
      <p className="mb-1 text-xs uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="font-mono text-lg font-semibold">{value || "--"}</p>
    </div>
  );
}
