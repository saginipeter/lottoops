"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ScanLine, Keyboard } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { normalizeBarcodeInput } from "@/lib/barcode";

interface BarcodeScannerProps {
  barcode: string;
  onChange: (value: string) => void;
}

export function BarcodeScanner({
  barcode,
  onChange,
}: BarcodeScannerProps) {
  const readerId = `lottoops-receive-barcode-reader-${useId().replace(/:/g, "")}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const operationRef = useRef(false);
  const cancelStartRef = useRef(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) void scanner.stop().catch(() => undefined).finally(() => scanner.clear());
    };
  }, []);

  const stopCamera = useCallback(async () => {
    cancelStartRef.current = true;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setCameraOpen(false);
    setCameraStarting(false);
    try {
      if (scanner) {
        await scanner.stop().catch(() => undefined);
        try { scanner.clear(); } catch { /* Scanner may still be releasing the camera. */ }
      }
    } finally {
      operationRef.current = false;
    }
  }, []);

  async function startCamera() {
    if (operationRef.current || scannerRef.current) return;
    operationRef.current = true;
    cancelStartRef.current = false;
    setCameraMessage("");
    setCameraStarting(true);
    setCameraOpen(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const scanner = new Html5Qrcode(readerId, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.ITF,
      ],
      useBarCodeDetectorIfSupported: true,
    });
    scannerRef.current = scanner;

    try {
      const scanConfig = { fps: 15, qrbox: { width: 240, height: 82 }, aspectRatio: 1.777778 };
      const onDecode = async (decodedText: string) => {
        if (scannerRef.current !== scanner) return;
        await stopCamera();
        onChange(normalizeBarcodeInput(decodedText));
        inputRef.current?.focus();
      };
      try {
        await scanner.start({ facingMode: { ideal: "environment" } }, scanConfig, onDecode, () => undefined);
      } catch {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras[0]) throw new Error("No camera found");
        await scanner.start(cameras[0].id, scanConfig, onDecode, () => undefined);
      }
      operationRef.current = false;
      if (cancelStartRef.current) {
        await scanner.stop().catch(() => undefined);
        try { scanner.clear(); } catch { /* Scanner may already be clear. */ }
        return;
      }
      setCameraStarting(false);
    } catch {
      scannerRef.current = null;
      try { scanner.clear(); } catch { /* Scanner may not have initialized. */ }
      if (!cancelStartRef.current) {
        setCameraOpen(false);
        setCameraStarting(false);
        setCameraMessage("Camera unavailable. Enter the barcode manually below.");
        inputRef.current?.focus();
      }
    } finally {
      operationRef.current = false;
    }
  }

  async function toggleCamera() {
    if (cameraOpen) await stopCamera();
    else await startCamera();
  }

  async function switchToManualEntry() {
    if (cameraOpen || cameraStarting) await stopCamera();
    inputRef.current?.focus();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;

    const cleaned = normalizeBarcodeInput(barcode ?? "");
    if (!cleaned) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    onChange(cleaned);
    inputRef.current?.blur();
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
          {cameraStarting ? "Starting Camera..." : cameraOpen ? "Close Camera" : "Use Phone Camera"}
        </button>
        {cameraMessage && <span className="text-xs text-amber-700">{cameraMessage}</span>}
      </div>
      <div className={cameraOpen ? "relative mt-3 min-h-[220px] overflow-hidden rounded-lg bg-black" : "hidden"}>
        <div id={readerId} className="min-h-[220px]" />
        <button type="button" onClick={() => { void switchToManualEntry(); }} className="absolute bottom-3 left-1/2 z-10 inline-flex min-h-10 -translate-x-1/2 items-center gap-2 rounded-md bg-white px-3 text-sm font-semibold text-text shadow">
          <Keyboard size={15} />Enter Code Manually
        </button>
      </div>

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
