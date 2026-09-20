"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, CameraOff, Keyboard } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { normalizeBarcodeInput } from "@/lib/barcode";

interface PhoneBarcodeScannerProps {
  onScan: (value: string) => void;
  disabled?: boolean;
}

export function PhoneBarcodeScanner({ onScan, disabled = false }: PhoneBarcodeScannerProps) {
  const readerId = `lottoops-phone-barcode-reader-${useId().replace(/:/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const operationRef = useRef(false);
  const cancelStartRef = useRef(false);
  const mountedRef = useRef(true);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        void scanner.stop().catch(() => undefined).finally(() => scanner.clear());
      }
    };
  }, []);

  const stopCamera = useCallback(async () => {
    cancelStartRef.current = true;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (mountedRef.current) {
      setActive(false);
      setStarting(false);
    }
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
    if (disabled || operationRef.current || scannerRef.current) return;
    operationRef.current = true;
    cancelStartRef.current = false;
    setMessage("");
    setManualMode(false);
    setStarting(true);
    setActive(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const scanner = new Html5Qrcode(readerId, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.ITF,
      ],
      useBarCodeDetectorIfSupported: true,
    });
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 120 }, aspectRatio: 1.777778 },
        async (decodedText) => {
          if (scannerRef.current !== scanner) return;
          await stopCamera();
          onScan(normalizeBarcodeInput(decodedText));
        },
        () => undefined
      );
      operationRef.current = false;
      if (cancelStartRef.current) {
        await scanner.stop().catch(() => undefined);
        try { scanner.clear(); } catch { /* Scanner may already be clear. */ }
        return;
      }
      if (mountedRef.current) setStarting(false);
    } catch {
      scannerRef.current = null;
      try { scanner.clear(); } catch { /* Scanner may not have initialized. */ }
      if (mountedRef.current && !cancelStartRef.current) {
        setActive(false);
        setStarting(false);
        setManualMode(true);
        setMessage("Camera unavailable. Enter the barcode manually below.");
      }
    } finally {
      operationRef.current = false;
    }
  }

  async function openManualEntry() {
    if (active || starting) await stopCamera();
    setManualMode(true);
    setMessage("");
  }

  function submitManualEntry() {
    const normalized = normalizeBarcodeInput(manualValue);
    if (!normalized) return;
    onScan(normalized);
    setManualValue("");
    setManualMode(false);
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-soft p-3 sm:hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-text">Phone camera</p>
          <p className="text-xs text-text-secondary">Point the rear camera at the ticket barcode.</p>
        </div>
        <Button
          type="button"
          variant={active ? "outline" : "secondary"}
          onClick={() => { void (active ? stopCamera() : startCamera()); }}
          disabled={disabled || starting}
          className="min-h-[44px] sm:min-h-0"
        >
          {active ? <CameraOff size={15} /> : <Camera size={15} />}
          {starting ? "Starting Camera..." : active ? "Stop Camera" : "Scan with Camera"}
        </Button>
      </div>
      <div className={active ? "relative mt-3 min-h-[220px] overflow-hidden rounded-md bg-black" : "hidden"}>
        <div id={readerId} className="min-h-[220px]" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-28 w-[90%] max-w-[320px] border border-white/50">
            <span className="absolute -left-0.5 -top-0.5 h-6 w-6 border-l-4 border-t-4 border-emerald-400" />
            <span className="absolute -right-0.5 -top-0.5 h-6 w-6 border-r-4 border-t-4 border-emerald-400" />
            <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 border-b-4 border-l-4 border-emerald-400" />
            <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 border-b-4 border-r-4 border-emerald-400" />
            <span className="absolute left-3 right-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-emerald-400/80" />
          </div>
        </div>
        <p className="absolute bottom-2 left-0 right-0 text-center text-xs font-semibold text-white drop-shadow">
          Scanning barcode...
        </p>
        <Button type="button" variant="secondary" size="sm" className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2" onClick={() => { void openManualEntry(); }}>
          <Keyboard size={14} />Enter Code Manually
        </Button>
      </div>
      {!active && <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => { void openManualEntry(); }} disabled={disabled}>
        <Keyboard size={14} />Enter Code Manually
      </Button>}
      {manualMode && <div className="mt-3 flex gap-2">
        <input
          autoFocus
          inputMode="numeric"
          value={manualValue}
          onChange={(event) => setManualValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitManualEntry(); } }}
          placeholder="Enter barcode number"
          className="min-h-11 min-w-0 flex-1 rounded-md border-2 border-border bg-white px-3 font-mono text-base outline-none focus:border-accent"
        />
        <Button type="button" onClick={submitManualEntry} disabled={!manualValue.trim()}>Submit</Button>
      </div>}
      {message && <p className="mt-2 text-xs font-medium text-amber-700">{message}</p>}
    </div>
  );
}
