"use client";

import { useRef } from "react";
import { ScanLine, Keyboard } from "lucide-react";

interface BarcodeScannerProps {
  barcode: string;
  onChange: (value: string) => void;
}

export function BarcodeScanner({
  barcode,
  onChange,
}: BarcodeScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();

      const cleaned = barcode.replace(/\s/g, "");

      if (cleaned.length >= 13) {
        onChange(cleaned);
      }

      inputRef.current?.select();
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-6">

      <div className="flex items-center gap-3 mb-6">

        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">

          <ScanLine
            className="text-purple-700"
            size={24}
          />

        </div>

        <div>

          <h3 className="text-lg font-semibold">
            Scan or Enter Pack Barcode
          </h3>

          <p className="text-sm text-gray-500">
            The system automatically extracts the Game Number,
            Pack Number and First Ticket.
          </p>

        </div>

      </div>

      <input
        ref={inputRef}
        autoFocus
        value={barcode}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="2632 002947 025"

        className="
          w-full
          rounded-xl
          border
          border-purple-300
          bg-purple-50
          px-5
          py-4
          font-mono
          text-xl
          tracking-widest
          outline-none
          transition
          focus:border-purple-600
          focus:ring-4
          focus:ring-purple-100
        "
      />

      <div className="mt-5 grid grid-cols-2 gap-4">

        <div className="rounded-lg bg-gray-50 p-4">

          <div className="flex items-center gap-2 mb-2">

            <Keyboard
              size={16}
              className="text-gray-500"
            />

            <span className="font-medium">
              Manual Entry
            </span>

          </div>

          <p className="text-sm text-gray-500">
            Type the barcode and press Enter.
          </p>

        </div>

        <div className="rounded-lg bg-purple-50 p-4">

          <div className="flex items-center gap-2 mb-2">

            <ScanLine
              size={16}
              className="text-purple-700"
            />

            <span className="font-medium text-purple-700">
              USB Scanner Ready
            </span>

          </div>

          <p className="text-sm text-purple-600">
            
          </p>

        </div>

      </div>

      <div className="mt-6 rounded-lg border border-dashed border-purple-300 bg-purple-50 p-4">

        <p className="text-sm font-medium text-purple-700">

          Barcode Format

        </p>

        <div className="mt-3 flex items-center justify-between text-center">

          <div>

            <div className="font-mono text-lg font-bold">
              2632
            </div>

            <div className="text-xs text-gray-500">
              Game #
            </div>

          </div>

          <div className="text-gray-400">|</div>

          <div>

            <div className="font-mono text-lg font-bold">
              002947
            </div>

            <div className="text-xs text-gray-500">
              Pack #
            </div>

          </div>

          <div className="text-gray-400">|</div>

          <div>

            <div className="font-mono text-lg font-bold">
              025
            </div>

            <div className="text-xs text-gray-500">
              First Ticket
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}