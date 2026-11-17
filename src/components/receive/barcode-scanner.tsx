"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ScanLine, Keyboard } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { isValidPackBarcode, normalizeBarcodeInput } from "@/lib/barcode";

interface BarcodeScannerProps {
  barcode: string;
  onScan: (value: string) => void;
  resumeKey?: number;
}

export function BarcodeScanner({
  barcode,
  onScan,
  resumeKey = 0,
}: BarcodeScannerProps) {
  const readerId = `lottoops-receive-barcode-reader-${useId().replace(/:/g, "")}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const operationRef = useRef(false);
  const cancelStartRef = useRef(false);
  const capturedBarcodeRef = useRef(false);
  const observedResumeKeyRef = useRef(resumeKey);
  const cameraMessageTimerRef = useRef<number | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const [inputValue, setInputValue] = useState(barcode);
  const inputValueRef = useRef(barcode);

  useEffect(() => {
    return () => {
      if (cameraMessageTimerRef.current !== null) window.clearTimeout(cameraMessageTimerRef.current);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) void scanner.stop().catch(() => undefined).finally(() => scanner.clear());
    };
  }, []);

  const showCameraMessage = useCallback((message: string) => {
    if (cameraMessageTimerRef.current !== null) window.clearTimeout(cameraMessageTimerRef.current);
    setCameraMessage(message);
    cameraMessageTimerRef.current = window.setTimeout(() => {
      setCameraMessage("");
      cameraMessageTimerRef.current = null;
    }, 4500);
  }, []);

  useEffect(() => {
    if (observedResumeKeyRef.current === resumeKey) return;
    observedResumeKeyRef.current = resumeKey;
    capturedBarcodeRef.current = false;
    inputRef.current?.focus();
    if (!cameraOpen || !scannerRef.current) return;
    try {
      scannerRef.current.resume();
      showCameraMessage("Camera ready for the next pack.");
    } catch {
      showCameraMessage("Camera could not resume. Close it and start the scanner again.");
    }
  }, [cameraOpen, resumeKey, showCameraMessage]);

  const stopCamera = useCallback(async () => {
    cancelStartRef.current = true;
    capturedBarcodeRef.current = false;
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

    try {
      // Avoid a fixed aspect-ratio constraint on portrait phones.
      // Use a wide, dynamic region for long 1D lottery barcodes. The former
      // fixed box clipped the barcode on portrait phones, leaving video live
      // but producing no decode callbacks.
      const scanConfig = {
        fps: 10,
        aspectRatio: 1.777778,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
          width: Math.min(Math.floor(viewfinderWidth * 0.92), 720),
          height: Math.min(Math.max(Math.floor(viewfinderHeight * 0.28), 120), 220),
        }),
        disableFlip: true,
      };
      const scannerConfig = {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
        ],
      };
      const cameraErrors: string[] = [];

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access requires HTTPS and a browser that supports camera access");
      }

      const permissionStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      permissionStream.getTracks().forEach((track) => track.stop());

      const cameras = await Html5Qrcode.getCameras();
      const rearCamera = cameras.find((camera) => /back|rear|environment|world/i.test(camera.label));
      const cameraSources: Array<string | MediaTrackConstraints> = [
        { facingMode: { exact: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        ...(rearCamera ? [rearCamera.id] : []),
        ...cameras.filter((camera) => camera.id !== rearCamera?.id).map((camera) => camera.id),
        { facingMode: { ideal: "environment" } },
      ];

      let startedScanner: Html5Qrcode | null = null;
      for (const cameraSource of cameraSources) {
        const scanner = new Html5Qrcode(readerId, scannerConfig);
        const onDecode = async (decodedText: string) => {
          if (scannerRef.current !== scanner) return;
          const normalized = normalizeBarcodeInput(decodedText);
          if (!isValidPackBarcode(normalized)) {
            showCameraMessage("Barcode detected, but it is not a complete 14-digit pack code. Move closer and keep the full barcode inside the guide.");
            return;
          }
          if (capturedBarcodeRef.current) return;
          capturedBarcodeRef.current = true;
          try { scanner.pause(true); } catch { /* The scanner callback is already handling this capture. */ }
          setInputValue("");
          onScan(normalized);
        };

        scannerRef.current = scanner;
        try {
          await scanner.start(cameraSource, scanConfig, onDecode, () => undefined);
          startedScanner = scanner;
          break;
        } catch (error) {
          cameraErrors.push(error instanceof Error ? error.message : String(error));
          scannerRef.current = null;
          try {
            if (scanner.isScanning) await scanner.stop();
          } catch { /* Continue with the next camera source. */ }
          try { scanner.clear(); } catch { /* Scanner may not have initialized. */ }
        }
      }

      if (!startedScanner) throw new Error(cameraErrors[0] ?? "No usable camera found");
      operationRef.current = false;
      if (cancelStartRef.current) {
        await stopCamera();
        return;
      }
      setCameraStarting(false);
    } catch (error) {
      const failedScanner = scannerRef.current;
      scannerRef.current = null;
      try {
        if (failedScanner?.isScanning) await failedScanner.stop();
      } catch { /* Camera may already have been released. */ }
      try { failedScanner?.clear(); } catch { /* Scanner may not have initialized. */ }
      if (!cancelStartRef.current) {
        setCameraOpen(false);
        setCameraStarting(false);
        const reason = error instanceof Error ? error.message : "Permission was denied or no camera was found.";
        showCameraMessage(`Camera unavailable (${reason}). Allow camera access, then try again.`);
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
    const value = e.target.value;
    inputValueRef.current = value;
    setInputValue(value);

    const cleaned = normalizeBarcodeInput(value).replace(/\D/g, "");
    if (!isValidPackBarcode(cleaned)) return;

    // Some barcode wedges append Enter. Clear synchronously to ensure that
    // suffix cannot submit the same pack a second time.
    inputValueRef.current = "";
    setInputValue("");
    onScan(cleaned);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;

    const cleaned = normalizeBarcodeInput(inputValueRef.current);
    if (!cleaned) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    inputValueRef.current = "";
    setInputValue("");
    onScan(cleaned);
    inputRef.current?.focus();
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
        value={inputValue}
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
            Type the complete 14-digit code; game detection starts automatically. Press Enter to submit an incomplete entry for validation.
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
