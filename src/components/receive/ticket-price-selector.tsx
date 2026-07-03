"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/panel";

const PRICE_PRESETS = [
  { price: 1, quantity: 300 },
  { price: 2, quantity: 150 },
  { price: 3, quantity: 100 },
  { price: 5, quantity: 75 },
  { price: 10, quantity: 50 },
  { price: 20, quantity: 25 },
  { price: 30, quantity: 25 },
  { price: 50, quantity: 20 },
  { price: 100, quantity: 15 },
];

interface TicketPriceSelectorProps {
  selectedPrice: number;
  onSelect: (price: number) => void;
}

export function TicketPriceSelector({
  selectedPrice,
  onSelect,
}: TicketPriceSelectorProps) {
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [quantity, setQuantity] = useState(0);

  useEffect(() => {
    if (overrideEnabled) return;

    const preset = PRICE_PRESETS.find(
      (item) => item.price === selectedPrice
    );

    if (preset) {
      setQuantity(preset.quantity);
    }
  }, [selectedPrice, overrideEnabled]);

  return (
    <Panel className="p-6">

      <div className="mb-6">
        <h3 className="text-lg font-semibold">
          Ticket Price & Quantity
        </h3>

        <p className="text-sm text-gray-500">
          Select the ticket denomination.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">

        {PRICE_PRESETS.map((item) => {

          const active = selectedPrice === item.price;

          return (
            <button
              key={item.price}
              type="button"
              onClick={() => onSelect(item.price)}
              className={`rounded-xl border p-4 text-left transition-all ${
                active
                  ? "border-purple-600 bg-purple-100 shadow"
                  : "border-gray-200 bg-white hover:border-purple-400"
              }`}
            >
              <div className="text-2xl font-bold">
                ${item.price}
              </div>

              <div className="mt-2 text-sm text-gray-500">
                {item.quantity} tickets
              </div>

            </button>
          );
        })}

      </div>

      <div className="mt-8 grid grid-cols-2 gap-6">

        <div>

          <label className="mb-2 block text-sm font-medium">
            Ticket Quantity
          </label>

          <input
            type="number"
            value={quantity}
            readOnly={!overrideEnabled}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-lg font-semibold"
          />

        </div>

        <div className="flex items-end">

          <label className="flex items-center gap-3">

            <input
              type="checkbox"
              checked={overrideEnabled}
              onChange={(e) =>
                setOverrideEnabled(e.target.checked)
              }
            />

            <span className="text-sm">
              Override quantity
            </span>

          </label>

        </div>

      </div>

      <div className="mt-6 rounded-lg bg-purple-50 p-4">

        <p className="font-medium text-purple-700">
          Current Selection
        </p>

        <p className="mt-2 text-sm text-purple-600">
          Ticket Price: <strong>${selectedPrice}</strong>
        </p>

        <p className="text-sm text-purple-600">
          Quantity: <strong>{quantity}</strong> tickets
        </p>

      </div>

    </Panel>
  );
}