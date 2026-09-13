"use client";

import { Panel } from "@/components/ui/panel";

const PRICE_PRESETS = [
  { price: 1 },
  { price: 2 },
  { price: 3 },
  { price: 5 },
  { price: 10 },
  { price: 20 },
  { price: 30 },
  { price: 50 },
  { price: 100 },
];

interface TicketPriceOnlyProps {
  selectedPrice: number;
  onSelect: (price: number) => void;
}

export function TicketPriceOnly({
  selectedPrice,
  onSelect,
}: TicketPriceOnlyProps) {
  return (
    <Panel className="p-6">

      <div className="mb-6">
        <h3 className="text-lg font-semibold">
          Select ticket price
        </h3>

        <p className="text-sm text-gray-500">
          Select the ticket denomination for this pack.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-3">

        {PRICE_PRESETS.map((item) => {

          const active = selectedPrice === item.price;

          return (
            <button
              key={item.price}
              type="button"
              onClick={() => onSelect(item.price)}
              className={`rounded-lg border p-3 text-center transition-all ${
                active
                  ? "border-purple-600 bg-purple-100 shadow"
                  : "border-gray-200 bg-white hover:border-purple-400"
              }`}
            >
              <div className="text-xl font-bold">
                ${item.price}
              </div>
            </button>
          );
        })}

      </div>

      <div className="mt-6 rounded-lg bg-purple-50 p-4">

        <p className="font-medium text-purple-700">
          Selected Price
        </p>

        <p className="mt-2 text-sm text-purple-600">
          Ticket Price: <strong>${selectedPrice}</strong>
        </p>

      </div>

    </Panel>
  );
}
