"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/panel";
import { getSuggestedTicketQuantity } from "@/lib/ticket-quantity";

interface TicketQuantityOnlyProps {
  selectedPrice: number;
  selectedQuantity: number;
  onSelect: (quantity: number) => void;
}

export function TicketQuantityOnly({
  selectedPrice,
  selectedQuantity,
  onSelect,
}: TicketQuantityOnlyProps) {
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [quantity, setQuantity] = useState(selectedQuantity);

  // Update quantity when price changes
  useEffect(() => {
    if (!overrideEnabled) {
      const preset = getSuggestedTicketQuantity(selectedPrice);
      setQuantity(preset);
      onSelect(preset);
    }
  }, [selectedPrice, overrideEnabled, onSelect]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQty = Number(e.target.value);
    setQuantity(newQty);
    if (overrideEnabled) {
      onSelect(newQty);
    }
  };

  const suggestedQuantity = getSuggestedTicketQuantity(selectedPrice);

  return (
    <Panel className="p-6">

      <div className="mb-6">
        <h3 className="text-lg font-semibold">
          Step 8: Select Ticket Quantity
        </h3>

        <p className="text-sm text-gray-500">
          Enter the number of tickets in this pack.
        </p>
      </div>

      <div className="space-y-6">

        <div>
          <label className="mb-2 block text-sm font-medium">
            Ticket Quantity
          </label>

          <input
            type="number"
            value={quantity}
            onChange={handleQuantityChange}
            readOnly={!overrideEnabled}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg font-semibold"
            placeholder="Enter quantity"
          />
          
          <p className="mt-2 text-xs text-gray-500">
            Suggested for ${selectedPrice}: {suggestedQuantity} tickets
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
          <input
            type="checkbox"
            id="override-qty"
            checked={overrideEnabled}
            onChange={(e) => {
              setOverrideEnabled(e.target.checked);
              if (!e.target.checked) {
                const preset = getSuggestedTicketQuantity(selectedPrice);
                setQuantity(preset);
                onSelect(preset);
              }
            }}
            className="h-4 w-4"
          />

          <label htmlFor="override-qty" className="text-sm font-medium cursor-pointer">
            Override suggested quantity
          </label>
        </div>

      </div>

      <div className="mt-6 rounded-lg bg-purple-50 p-4">

        <p className="font-medium text-purple-700">
          Summary
        </p>

        <p className="mt-2 text-sm text-purple-600">
          Price: <strong>${selectedPrice}</strong>
        </p>

        <p className="text-sm text-purple-600">
          Quantity: <strong>{quantity}</strong> tickets
        </p>

      </div>

    </Panel>
  );
}
