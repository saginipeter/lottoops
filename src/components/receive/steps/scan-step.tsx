"use client";

import { useMemo, useState } from "react";

import {
  ShipmentPack,
  parseBarcode,
  DENOMINATION_LOOKUP,
} from "@/data/mock-shipment";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

import { BarcodeScanner } from "../barcode-scanner";
import { TicketPriceSelector } from "../ticket-price-selector";
import { ShipmentSummary } from "../shipment-summary";
import { ScannedPackTable } from "../scanned-pack-table";

interface ScanStepProps {
  shipment: any;
  packs: ShipmentPack[];

  addPack: (pack: ShipmentPack) => void;
  removePack: (id: string) => void;

  nextStep: () => void;
  previousStep: () => void;
}

export function ScanStep({
  shipment,
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
    return DENOMINATION_LOOKUP[ticketPrice];
  }, [ticketPrice]);

  function handleScan(value: string) {
    setBarcode(value);

    const parsed = parseBarcode(value);

    setGameNumber(parsed.gameNumber);
    setPackNumber(parsed.packNumber);
    setFirstTicket(parsed.firstTicket);
  }

  function handleAddPack() {
    if (!gameNumber || !packNumber) return;

    addPack({
      id: crypto.randomUUID(),

      gameNumber,

      gameName: `Game ${gameNumber}`,

      packNumber,

      firstTicket,

      ticketPrice,

      quantity,

      status: "Logged",
    });

    setBarcode("");
    setGameNumber("");
    setPackNumber("");
    setFirstTicket("");
  }

  return (
    <div className="grid grid-cols-3 gap-6">

      {/* LEFT */}

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

      {/* RIGHT */}

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