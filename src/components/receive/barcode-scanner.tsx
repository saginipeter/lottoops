"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine, Keyboard } from "lucide-react";
import { normalizeBarcodeInput } from "@/lib/barcode";

interface BarcodeScannerProps {
  barcode: string;
  onChange: (value: string) => void;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
}

interface BarcodeDetectorConstructorLike {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructorLike;
  }
}

export function BarcodeScanner({
  barcode,
  onChange,
}: BarcodeScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  async function toggleCamera() {
    if (cameraOpen) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraOpen(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage("Camera access is not available in this browser.");
      return;
    }
    if (!window.BarcodeDetector) {
      setCameraMessage("Camera barcode scanning is not supported on this phone. Use manual entry or a USB scanner.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      setCameraMessage("");
      setCameraOpen(true);
      const detector = new window.BarcodeDetector({ formats: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf"] });
      const scanFrame = async () => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const detected = await detector.detect(video).catch(() => []);
          const value = detected[0]?.rawValue?.trim();
          if (value) {
            onChange(normalizeBarcodeInput(value));
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setCameraOpen(false);
            inputRef.current?.focus();
            return;
          }
        }
        window.setTimeout(() => { void scanFrame(); }, 250);
      };
      window.setTimeout(() => { void scanFrame(); }, 250);
    } catch {
      setCameraMessage("Camera permission was denied or unavailable.");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();

      const cleaned = barcode.replace(/\s/g, "");

      if (cleaned.length >= 11) {
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
            and Pack Number from the first 11 digits.
          </p>

        </div>

      </div>

      <input
        ref={inputRef}
        autoFocus
        inputMode="numeric"
        pattern="[0-9]*"
        value={barcode}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Scan Pack"

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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { void toggleCamera(); }} className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-surface-soft">
          {cameraOpen ? "Close Camera" : "Use Phone Camera"}
        </button>
        {cameraMessage && <span className="text-xs text-amber-700">{cameraMessage}</span>}
      </div>
      {cameraOpen && (
        <video ref={videoRef} autoPlay playsInline muted className="mt-3 h-52 w-full rounded-lg bg-black object-cover" />
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">

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
            Type digits only and press Enter.
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

    </div>
  );
}