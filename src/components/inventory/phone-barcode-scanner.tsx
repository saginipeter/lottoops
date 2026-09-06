"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";

interface PhoneBarcodeScannerProps {
  onScan: (value: string) => void;
  disabled?: boolean;
}

const READER_ID = "lottoops-phone-barcode-reader";

export function PhoneBarcodeScanner({ onScan, disabled = false }: PhoneBarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        void scanner.stop().catch(() => undefined);
        scanner.clear();
      }
    };
  }, []);

  async function stopCamera() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setActive(false);
    if (!scanner) return;
    await scanner.stop().catch(() => undefined);
    scanner.clear();
  }

  async function startCamera() {
    if (disabled) return;
    setMessage("");
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;
    setActive(true);

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 120 }, aspectRatio: 1.777778 },
        async (decodedText) => {
          await stopCamera();
          onScan(decodedText);
        },
        () => undefined
      );
      setActive(true);
    } catch {
      scannerRef.current = null;
      setActive(false);
      scanner.clear();
      setMessage("Camera unavailable. Allow camera access or use the barcode field.");
    }
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
          disabled={disabled}
          className="min-h-[44px] sm:min-h-0"
        >
          {active ? <CameraOff size={15} /> : <Camera size={15} />}
          {active ? "Stop Camera" : "Scan with Camera"}
        </Button>
      </div>
      <div className={active ? "relative mt-3 overflow-hidden rounded-md bg-black" : "hidden"}>
        <div id={READER_ID} className="min-h-[180px]" />
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
      </div>
      {message && <p className="mt-2 text-xs font-medium text-amber-700">{message}</p>}
    </div>
  );
}
