"use client";

import { useMemo, useState } from "react";

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
  
  // Step 6: Pack image upload
  const [packImage, setPackImage] = useState("");
  
  // Step 7.5: Lot number
  const [lotNumber, setLotNumber] = useState("");

  function handleScan(value: string) {
    setBarcode(value);

    const parsed = parseBarcode(value);

    setGameNumber(parsed.gameNumber);
    setPackNumber(parsed.packNumber);
    setFirstTicket(parsed.firstTicket);
  }

  async function handleAddPack() {
    if (!gameNumber || !packNumber) return;
    
    if (!packImage) {
      alert("Please upload a pack image.");
      return;
    }

    try {
      const response = await fetch("/api/packs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      if (!response.ok) {
        alert(savedPack.error);
        return;
      }

      addPack(savedPack);

      setShipment((prev) => ({
        ...prev,
        scannedPacks: (prev.scannedPacks ?? 0) + 1,
      }));

      setBarcode("");
      setGameNumber("");
      setPackNumber("");
      setFirstTicket("");
      setPackImage("");
      setLotNumber("");
    } catch (err) {
      console.error(err);
      alert("Unable to save pack.");
    }
  }

  return (
    <div className="grid grid-cols-3 gap-6">

      <div className="col-span-2 space-y-6">

        {/* Barcode Scanning */}
        <Panel className="p-6">

          <h2 className="mb-5 text-xl font-semibold">
            Step 5: Scan Lottery Packs
          </h2>

          <BarcodeScanner
            barcode={barcode}
            onChange={handleScan}
          />

          <div className="mt-6 grid grid-cols-3 gap-4">

            <InfoCard
              label="Game #"
              value={gameNumber}
            />

            <InfoCard
              label="Pack #"
              value={packNumber}
            />

            <InfoCard
              label="First Ticket"
              value={firstTicket}
            />

          </div>

        </Panel>

        {/* Step 6: Pack Image Upload */}
        <Panel className="p-6">

          <div className="mb-4">
            <h3 className="text-lg font-semibold">
              Step 6: Upload Pack Image
            </h3>

            <p className="text-sm text-gray-500">
              Upload a photo of the pack.
            </p>
          </div>

          <InvoiceUpload
            value={packImage}
            onChange={setPackImage}
          />
          
          {packImage && (
            <div className="mt-4">
              <p className="text-sm text-green-600">✓ Image uploaded</p>
            </div>
          )}

        </Panel>

        {/* Step 7: Ticket Price */}
        <TicketPriceOnly
          selectedPrice={ticketPrice}
          onSelect={setTicketPrice}
        />

        {/* Step 8: Ticket Quantity */}
        <TicketQuantityOnly
          selectedPrice={ticketPrice}
          selectedQuantity={ticketQuantity}
          onSelect={setTicketQuantity}
        />

        {/* Lot Number (Optional for now, can be added during activation) */}
        <Panel className="p-6">

          <div className="mb-4">
            <h3 className="text-lg font-semibold">
              Lot Number (Optional)
            </h3>

            <p className="text-sm text-gray-500">
              Enter the lot number if available.
            </p>
          </div>

          <input
            className="w-full rounded-lg border px-4 py-3"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            placeholder="Enter lot number"
          />

        </Panel>

        {/* Add Pack Button */}
        <Panel className="p-6">

          <Button
            className="w-full"
            onClick={handleAddPack}
          >
            Add Pack
          </Button>

        </Panel>

        <ScannedPackTable
          packs={packs}
          removePack={removePack}
        />

      </div>

      <ShipmentSummary
        shipment={shipment}
        packs={packs}
      >

        <div className="space-y-3">

          <Button
            variant="secondary"
            className="w-full"
            onClick={previousStep}
          >
            ← Back
          </Button>

          <Button
            className="w-full"
            onClick={nextStep}
            disabled={packs.length === 0}
          >
            Review Shipment →
          </Button>

        </div>

      </ShipmentSummary>

    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-soft p-4">

      <p className="mb-1 text-xs uppercase tracking-wide text-text-secondary">
        {label}
      </p>

      <p className="font-mono text-lg font-semibold">
        {value || "--"}
      </p>

    </div>
  );
}