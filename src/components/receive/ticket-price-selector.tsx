"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/panel";
import { PRICE_PRESETS } from "@/data/mock-shipment";

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
    const preset = PRICE_PRESETS.find(
      (item) => item.price === selectedPrice
    );

    if (preset && !overrideEnabled) {
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
          Select the denomination. Quantity loads automatically.
        </p>

      </div>

      {/* Price Cards */}

      <div className="grid grid-cols-4 gap-4">

        {PRICE_PRESETS.map((item) => {

          const active = selectedPrice === item.price;

          return (

            <button
              key={item.price}
              onClick={() => onSelect(item.price)}
              className={`
                rounded-xl
                border
                p-4
                text-left
                transition-all

                ${
                  active
                    ? "border-purple-600 bg-purple-100 shadow"
                    : "border-gray-200 bg-white hover:border-purple-400"
                }
              `}
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

      {/* Preset */}

      <div className="mt-8 grid grid-cols-2 gap-6">

        <div>

          <label className="block mb-2 text-sm font-medium">
            Preset Quantity
          </label>

          <input
            readOnly={!overrideEnabled}
            type="number"
            value={quantity}
            onChange={(e) =>
              setQuantity(Number(e.target.value))
            }
            className="
              w-full
              rounded-lg
              border
              border-gray-300
              bg-gray-50
              px-4
              py-3
              text-lg
              font-semibold
            "
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

              Override preset quantity

            </span>

          </label>

        </div>

      </div>

      <div className="mt-6 rounded-lg bg-purple-50 p-4">

        <p className="text-sm text-purple-700">

          <strong>Example:</strong>

        </p>

        <ul className="mt-2 space-y-1 text-sm text-purple-600">

          <li>$1 → 300 tickets</li>

          <li>$2 → 150 tickets</li>

          <li>$3 → 100 tickets</li>

          <li>$5 → 75 tickets</li>

          <li>$10 → 50 tickets</li>

          <li>$20 → 25 tickets</li>

          <li>$30 → 25 tickets</li>

          <li>$100 → 15 tickets</li>

        </ul>

      </div>

    </Panel>
  );
}