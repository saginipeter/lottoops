"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export default function TicketScanner() {

  const [barcode, setBarcode] = useState("");

  async function handleLookup() {

    if (!barcode) return;

    console.log(barcode);

    // API lookup will come next

  }

  return (
    <div className="space-y-4">

      <input
        autoFocus
        className="w-full rounded-lg border px-4 py-4 font-mono text-lg"
        placeholder="Scan ticket barcode..."
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleLookup();
          }
        }}
      />

      <Button
        onClick={handleLookup}
        className="w-full"
      >
        Lookup Ticket
      </Button>

    </div>
  );
}