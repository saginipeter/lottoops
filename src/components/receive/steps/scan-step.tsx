"use client";

import { useMemo, useState } from "react";

import type { PackWithGame, ShipmentState } from "@/lib/types";
import { parseBarcode } from "@/lib/barcode";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

import { BarcodeScanner } from "../barcode-scanner";
import { TicketPriceSelector } from "../ticket-price-selector";
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

  const quantity = useMemo(() => {
    switch (ticketPrice) {
      case 1:
        return 300;
      case 2:
        return 150;
      case 5:
        return 60;
      case 10:
        return 30;
      case 20:
        return 15;
      case 30:
        return 10;
      case 50:
        return 6;
      default:
        return 30;
    }
  }, [ticketPrice]);

  function handleScan(value: string) {
    setBarcode(value);

    const parsed = parseBarcode(value);

    setGameNumber(parsed.gameNumber);
    setPackNumber(parsed.packNumber);
    setFirstTicket(parsed.firstTicket);
  }

  async function handleAddPack() {
    if (!gameNumber || !packNumber) return;

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
          ticketQuantity: quantity,
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
    } catch (err) {
      console.error(err);
      alert("Unable to save pack.");
    }
  }

  return (
    <div className="grid grid-cols-3 gap-6">

      <div className="col-span-2 space-y-6">

        <Panel className="p-6">

          <h2 className="mb-5 text-xl font-semibold">
            Scan Lottery Packs
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

        <TicketPriceSelector
          selectedPrice={ticketPrice}
          onSelect={setTicketPrice}
        />

        <Panel className="p-6">

          <div className="mb-4 flex items-center justify-between">

            <div>

              <h3 className="font-semibold">
                Quantity Preset
              </h3>

              <p className="text-sm text-gray-500">
                Loaded automatically from denomination
              </p>

            </div>

            <div className="text-3xl font-bold text-purple-700">
              {quantity}
            </div>

          </div>

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