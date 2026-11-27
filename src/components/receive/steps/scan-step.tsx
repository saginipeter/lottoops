"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";

import type { PackWithGame, ShipmentState } from "@/lib/types";
import { isValidPackBarcode, normalizeBarcodeInput, parseBarcode } from "@/lib/barcode";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { InlineGuidance } from "@/components/ui/inline-guidance";

import { BarcodeScanner } from "../barcode-scanner";
import { TicketPriceOnly } from "../ticket-price-only";
import { InvoiceUpload } from "../invoice-upload";
import { ScannedPackTable } from "../scanned-pack-table";
import { getSuggestedTicketQuantity } from "@/lib/ticket-quantity";
import { DRAFT_PACK_PREFIX, isDraftPack } from "@/lib/receiving-draft";
import { ERROR_NOTICE_DURATION_MS, RECEIVING_SUCCESS_NOTICE_DURATION_MS } from "@/lib/notification-timing";

export { DRAFT_PACK_PREFIX, isDraftPack } from "@/lib/receiving-draft";

interface DetectedGame {
  source: "store" | "catalog";
  name: string;
  price: number;
  ticketsPerPack: number;
}

interface ScanStepProps {
  shipment: ShipmentState;
  packs: PackWithGame[];
  scanDraft: {
    barcode: string;
    gameNumber: string;
    packNumber: string;
    firstTicket: string;
    ticketPrice: number;
    ticketQuantity: number;
    packImage: string;
  };
  setScanDraft: React.Dispatch<
    React.SetStateAction<{
      barcode: string;
      gameNumber: string;
      packNumber: string;
      firstTicket: string;
      ticketPrice: number;
      ticketQuantity: number;
      packImage: string;
    }>
  >;
  addPack: (pack: PackWithGame) => void;
  removePack: (id: string) => void | Promise<void>;
  persistSelectedPacks: (packIds: string[]) => Promise<{ success: boolean; message?: string }>;
  nextStep: () => void | Promise<void>;
  savingPacks?: boolean;
  previousStep: () => void;
  onCancel: () => void;
}

export function ScanStep({
  shipment,
  packs,
  scanDraft,
  setScanDraft,
  addPack,
  removePack,
  persistSelectedPacks,
  nextStep,
  savingPacks = false,
  previousStep,
  onCancel,
}: ScanStepProps) {
  const {
    barcode,
    gameNumber,
    packNumber,
    firstTicket,
    ticketPrice,
    ticketQuantity,
    packImage,
  } = scanDraft;

  // Auto-detection state
  const [detecting, setDetecting] = useState(false);
  const [detectedGame, setDetectedGame] = useState<DetectedGame | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [addingSelected, setAddingSelected] = useState(false);
  const [savingPack, setSavingPack] = useState(false);
  const [autoStageDetectedPacks, setAutoStageDetectedPacks] = useState(true);
  const [cameraResumeKey, setCameraResumeKey] = useState(0);
  const scanNoticeTimer = useRef<number | null>(null);
  const scanQueueRef = useRef<string[]>([]);
  const processingScanRef = useRef(false);
  const waitingForManualRef = useRef(false);
  const processScanQueueRef = useRef<() => void>(() => undefined);
  const activeBarcodeRef = useRef<string | null>(null);
  const pendingManualBarcodeRef = useRef<string | null>(null);
  const reservedPackBarcodesRef = useRef(new Set(packs.map((pack) => pack.serialNumber)));
  const stagedPackCountRef = useRef(packs.length);
  const [queuedScanCount, setQueuedScanCount] = useState(0);
  const [quantityOverrideEnabled, setQuantityOverrideEnabled] = useState(false);
  const [manualOverrideEnabled, setManualOverrideEnabled] = useState(false);
  const expectedPacks = Number(shipment.expectedPacks ?? 0);
  const atExpectedLimit = expectedPacks > 0 && packs.length >= expectedPacks;
  const shipmentReady = Boolean(shipment.id) && expectedPacks > 0;
  const validBarcode = isValidPackBarcode(barcode);
  const draftPacks = packs.filter(isDraftPack);
  const selectedDraftPacks = draftPacks.filter((pack) => selectedPackIds.includes(pack.id));

  const showScanNotice = useCallback((message: string, kind: "success" | "error") => {
    if (scanNoticeTimer.current !== null) window.clearTimeout(scanNoticeTimer.current);
    setScanNotice({ message, kind });
    scanNoticeTimer.current = window.setTimeout(() => {
      setScanNotice(null);
      scanNoticeTimer.current = null;
    }, kind === "error" ? ERROR_NOTICE_DURATION_MS : RECEIVING_SUCCESS_NOTICE_DURATION_MS);
  }, []);

  useEffect(() => () => {
    if (scanNoticeTimer.current !== null) window.clearTimeout(scanNoticeTimer.current);
  }, []);

  useEffect(() => {
    stagedPackCountRef.current = packs.length;
    for (const pack of packs) reservedPackBarcodesRef.current.add(pack.serialNumber);
  }, [packs]);

  // After a barcode is parsed, auto-detect the game
  const detectGame = useCallback(async (gn: string): Promise<DetectedGame | null> => {
    if (!gn) return null;
    setDetecting(true);
    setDetectedGame(null);
    setDetectionError(null);
    try {
      const res = await fetch(`/api/packs/detect-game?gameNumber=${encodeURIComponent(gn)}`);
      const data = await res.json();
      if (res.ok && data.found) {
        const detected = data as DetectedGame;
        setDetectedGame(detected);
        setManualOverrideEnabled(false);
        setQuantityOverrideEnabled(false);
        setScanDraft((prev) => ({
          ...prev,
          ticketPrice: data.price,
          ticketQuantity: data.ticketsPerPack,
        }));
        return detected;
      } else {
        setDetectionError("Game not found in catalog — please select price & quantity manually.");
        setManualOverrideEnabled(true);
        return null;
      }
    } catch {
      setDetectionError("Could not reach server for auto-detect.");
      setManualOverrideEnabled(true);
      return null;
    } finally {
      setDetecting(false);
    }
  }, [setScanDraft]);

  function updateQueuedScanCount() {
    setQueuedScanCount(
      scanQueueRef.current.length +
      Number(activeBarcodeRef.current !== null) +
      Number(pendingManualBarcodeRef.current !== null)
    );
  }

  function resetCurrentScan() {
    activeBarcodeRef.current = null;
    pendingManualBarcodeRef.current = null;
    waitingForManualRef.current = false;
    setScanDraft((prev) => ({ ...prev, barcode: "", gameNumber: "", packNumber: "", firstTicket: "", packImage: "" }));
    setDetectedGame(null);
    setDetectionError(null);
    setCameraResumeKey((prev) => prev + 1);
    updateQueuedScanCount();
  }

  function stagePack(details: {
    barcode: string;
    ticketPrice: number;
    ticketQuantity: number;
    firstTicket: number;
    gameName?: string;
    packImage?: string | null;
  }): boolean {
    const normalizedBarcode = details.barcode.replace(/\D/g, "").slice(0, 11);
    if (stagedPackCountRef.current >= expectedPacks) {
      showScanNotice(`This shipment already reached expected packs (${expectedPacks}).`, "error");
      return false;
    }
    if (reservedPackBarcodesRef.current.has(normalizedBarcode) && activeBarcodeRef.current !== details.barcode && pendingManualBarcodeRef.current !== details.barcode) {
      showScanNotice(`Pack ${normalizedBarcode} is already in this shipment or scan queue.`, "error");
      return false;
    }
    if (!Number.isFinite(details.ticketPrice) || details.ticketPrice <= 0 || !Number.isInteger(details.ticketQuantity) || details.ticketQuantity <= 0 || !Number.isInteger(details.firstTicket) || details.firstTicket < 1 || details.firstTicket > details.ticketQuantity) {
      showScanNotice("Check the pack's ticket price, quantity, and first ticket before staging it.", "error");
      return false;
    }

    const gameNumberForPack = normalizedBarcode.slice(0, 4);
    const draftPack = {
      id: `${DRAFT_PACK_PREFIX}${normalizedBarcode}-${Date.now()}`,
      serialNumber: normalizedBarcode,
      gameNumber: gameNumberForPack,
      packNumber: normalizedBarcode.slice(4, 11),
      firstTicket: details.firstTicket,
      ticketPrice: details.ticketPrice,
      ticketQuantity: details.ticketQuantity,
      packImage: details.packImage || null,
      status: "SCANNED",
      game: {
        gameNumber: gameNumberForPack,
        name: details.gameName || `Game ${gameNumberForPack}`,
        price: details.ticketPrice,
        ticketsPerPack: details.ticketQuantity,
      },
    } as unknown as PackWithGame;

    setSavingPack(true);
    addPack(draftPack);
    stagedPackCountRef.current += 1;
    reservedPackBarcodesRef.current.add(normalizedBarcode);
    setSelectedPackIds((prev) => [...prev, draftPack.id]);
    resetCurrentScan();
    showScanNotice(`Pack ${draftPack.serialNumber} added to the scanned list. Continue scanning; add selected packs to the shipment when ready.`, "success");
    setSavingPack(false);
    return true;
  }

  async function processScanQueue() {
    if (processingScanRef.current || waitingForManualRef.current || scanQueueRef.current.length === 0) return;
    processingScanRef.current = true;
    const rawBarcode = scanQueueRef.current.shift()!;
    activeBarcodeRef.current = rawBarcode;
    updateQueuedScanCount();

    const parsed = parseBarcode(rawBarcode);
    setScanDraft((prev) => ({
      ...prev,
      barcode: rawBarcode,
      gameNumber: parsed.gameNumber,
      packNumber: parsed.packNumber,
      firstTicket: parsed.firstTicket,
      ticketPrice: 10,
      ticketQuantity: 50,
      packImage: "",
    }));
    setManualOverrideEnabled(false);
    setQuantityOverrideEnabled(false);
    showScanNotice(`Checking pack ${rawBarcode.slice(0, 11)}…`, "success");

    try {
      const game = await detectGame(parsed.gameNumber);
      if (game && autoStageDetectedPacks) {
        stagePack({
          barcode: rawBarcode,
          ticketPrice: game.price,
          ticketQuantity: game.ticketsPerPack,
          firstTicket: Number(parsed.firstTicket),
          gameName: game.name,
        });
      } else {
        setDetectedGame(game);
        setManualOverrideEnabled(!game);
        pendingManualBarcodeRef.current = rawBarcode;
        waitingForManualRef.current = true;
        activeBarcodeRef.current = null;
        setScanDraft((prev) => ({
          ...prev,
          barcode: rawBarcode,
          gameNumber: parsed.gameNumber,
          packNumber: parsed.packNumber,
          firstTicket: parsed.firstTicket,
          ticketPrice: game?.price ?? 10,
          ticketQuantity: game?.ticketsPerPack ?? 50,
        }));
        showScanNotice(
          game
            ? `Pack ${rawBarcode.slice(0, 11)} is ready. Review or override the details, then add it to the scanned list.`
            : `Game ${parsed.gameNumber} was not found. Enter the correct price and quantity, then add pack ${rawBarcode.slice(0, 11)}.`,
          "success"
        );
      }
    } finally {
      processingScanRef.current = false;
      updateQueuedScanCount();
      if (!waitingForManualRef.current && scanQueueRef.current.length > 0) {
        window.setTimeout(() => processScanQueueRef.current(), 0);
      }
    }
  }

  useEffect(() => {
    processScanQueueRef.current = () => { void processScanQueue(); };
  });

  function handleScan(value: string) {
    const cleanedBarcode = normalizeBarcodeInput(value).replace(/\D/g, "");
    if (!shipmentReady) {
      showScanNotice("Save the shipment details and expected pack count before scanning packs.", "error");
      previousStep();
      return;
    }
    if (!isValidPackBarcode(cleanedBarcode)) {
      showScanNotice("Scan the complete 14-digit pack barcode (11 pack digits plus 3 ticket digits).", "error");
      return;
    }

    const serialNumber = cleanedBarcode.slice(0, 11);
    if (reservedPackBarcodesRef.current.has(serialNumber)) {
      showScanNotice(`Pack ${serialNumber} has already been scanned for this shipment.`, "error");
      return;
    }
    const inProgressCount = Number(activeBarcodeRef.current !== null) + Number(pendingManualBarcodeRef.current !== null) + scanQueueRef.current.length;
    if (stagedPackCountRef.current + inProgressCount >= expectedPacks) {
      showScanNotice(`This shipment has space for only ${expectedPacks} packs.`, "error");
      return;
    }

    reservedPackBarcodesRef.current.add(serialNumber);
    scanQueueRef.current.push(cleanedBarcode);
    updateQueuedScanCount();
    showScanNotice(`Pack ${serialNumber} scanned. Looking up its game details.`, "success");
    processScanQueueRef.current();
  }

  function handleAddPack() {
    if (savingPack || detecting) return;
    if (!shipment.id) {
      showScanNotice("Save the shipment details before scanning packs.", "error");
      previousStep();
      return;
    }
    const cleanedBarcode = barcode.replace(/\D/g, "");
    if (!isValidPackBarcode(cleanedBarcode)) {
      showScanNotice("Scan the complete 14-digit pack barcode (11 pack digits plus 3 ticket digits).", "error");
      return;
    }
    if (!gameNumber || !packNumber || !/^[0-9]{7}$/.test(packNumber)) {
      showScanNotice("Check the game and pack numbers before staging this pack.", "error");
      return;
    }
    if (pendingManualBarcodeRef.current && pendingManualBarcodeRef.current !== cleanedBarcode) {
      showScanNotice("Finish the current pack details before continuing the scan queue.", "error");
      return;
    }
    const staged = stagePack({
      barcode: cleanedBarcode,
      ticketPrice: Number(ticketPrice),
      ticketQuantity: Number(ticketQuantity),
      firstTicket: Number(firstTicket),
      gameName: detectedGame?.name,
      packImage: packImage || null,
    });
    if (staged && scanQueueRef.current.length > 0) {
      window.setTimeout(() => processScanQueueRef.current(), 0);
    }
  }

  async function handleAddSelectedPacks() {
    if (addingSelected || savingPacks || selectedDraftPacks.length === 0) return;
    setAddingSelected(true);
    const selectedIds = selectedDraftPacks.map((pack) => pack.id);
    try {
      const result = await persistSelectedPacks(selectedIds);
      if (!result.success) {
        showScanNotice(result.message || "Unable to add the selected packs to this shipment.", "error");
        return;
      }
      setSelectedPackIds((prev) => prev.filter((id) => !selectedIds.includes(id)));
      showScanNotice(`${selectedIds.length} pack${selectedIds.length === 1 ? "" : "s"} added to the shipment.`, "success");
    } finally {
      setAddingSelected(false);
    }
  }

  async function removeScannedPack(id: string) {
    await removePack(id);
    const removedPack = packs.find((pack) => pack.id === id);
    if (removedPack) reservedPackBarcodesRef.current.delete(removedPack.serialNumber);
    stagedPackCountRef.current = Math.max(0, stagedPackCountRef.current - 1);
    setSelectedPackIds((prev) => prev.filter((packId) => packId !== id));
    updateQueuedScanCount();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
        <InlineGuidance title="Step 2 · Scan and Select Packs" className="lg:col-span-2">
          Scan pack barcodes, check any unmatched game details, and select the packs to add to this shipment.
        </InlineGuidance>
        {scanNotice && (
          <div className={`pointer-events-none fixed inset-x-3 top-4 z-[70] mx-auto flex w-fit max-w-[min(42rem,calc(100vw-1.5rem))] items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-xl sm:inset-x-4 sm:px-5 sm:py-4 ${scanNotice.kind === "error" ? "border-red-300 bg-red-50 text-red-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`} role={scanNotice.kind === "error" ? "alert" : "status"} aria-live={scanNotice.kind === "error" ? "assertive" : "polite"}>
            <span className="flex-1">{scanNotice.message}</span>
            {scanNotice.kind === "error" && <button type="button" onClick={() => setScanNotice(null)} className="pointer-events-auto rounded p-1 hover:bg-red-100" aria-label="Dismiss receiving error"><X size={18} /></button>}
          </div>
        )}

        {/* Scan packs */}
        <Panel className="p-5">
          <div className="mb-5"><h2 className="text-xl font-semibold">Scan Pack</h2></div>
          <label className="mb-4 flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={autoStageDetectedPacks}
              onChange={(event) => setAutoStageDetectedPacks(event.target.checked)}
              className="h-4 w-4"
            />
            Automatically add catalog-matched packs to the scanned list
          </label>
          <p className="mb-4 text-xs text-text-secondary">Turn this off to review or override price and quantity before each pack is staged.</p>
          <BarcodeScanner barcode={barcode} onScan={handleScan} resumeKey={cameraResumeKey} />
          {queuedScanCount > 0 && (
            <p role="status" className="mt-2 text-xs font-medium text-blue-700">
              Processing {queuedScanCount} scanned pack{queuedScanCount === 1 ? "" : "s"} in order.
            </p>
          )}

          {/* Auto-detection result */}
          {gameNumber && (
            <div className="mt-4">
              {detecting && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  Detecting game from the Lottery Scratch_off Management System catalog…
                </div>
              )}
              {!detecting && detectedGame && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        ✓ Game Detected
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${detectedGame.source === "store" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {detectedGame.source === "store" ? "Store Catalog" : "Lottery Scratch_off Sync"}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-emerald-700 font-medium">{detectedGame.name}</p>
                      <p className="text-xs text-emerald-600">
                        ${detectedGame.price} ticket · {detectedGame.ticketsPerPack} tickets/pack
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {!detecting && detectionError && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                  ⚠ {detectionError}
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* Pack image */}
        <Panel className="p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Pack image</h3>
            <p className="text-sm text-gray-500">Upload a photo of the pack.</p>
          </div>
          <InvoiceUpload
            value={packImage}
            title="Upload Pack Image"
            previewAlt="Pack image"
            errorMessage="Failed to upload pack image."
            onChange={(url) =>
              setScanDraft((prev) => ({
                ...prev,
                packImage: url,
              }))
            }
          />
          <p className="mt-2 text-[11px] text-text-tertiary">Optional — add a photo only when the pack needs visual verification.</p>
          {packImage && <p className="mt-2 text-sm text-green-600">✓ Image uploaded</p>}
        </Panel>

        {/* Ticket price */}
        {(!detectedGame || manualOverrideEnabled) && <div className="relative">
          {detectedGame && (
            <div className="absolute right-6 top-5 z-10">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Auto-filled ✓
              </span>
            </div>
          )}
          <TicketPriceOnly
            selectedPrice={ticketPrice}
            onSelect={(value) =>
              setScanDraft((prev) => ({
                ...prev,
                ticketPrice: value,
              }))
            }
          />
        </div>}

        {(!detectedGame || manualOverrideEnabled) && <Panel className="p-5">
          <h3 className="text-lg font-semibold">Ticket Quantity</h3>
          <p className="mt-1 text-sm text-gray-500">The suggested quantity is used by default. Enable override for store testing.</p>
          <label className="mt-4 flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={quantityOverrideEnabled}
              onChange={(event) => {
                const enabled = event.target.checked;
                setQuantityOverrideEnabled(enabled);
                if (!enabled) {
                  setScanDraft((prev) => ({
                    ...prev,
                    ticketQuantity: getSuggestedTicketQuantity(prev.ticketPrice),
                  }));
                }
              }}
              className="h-4 w-4"
            />
            Override default ticket quantity
          </label>
          <input
            type="number"
            onWheel={(event) => event.currentTarget.blur()}
            min={1}
            step={1}
            value={ticketQuantity}
            readOnly={!quantityOverrideEnabled}
            onChange={(event) => {
              const value = Number(event.target.value);
              setScanDraft((prev) => ({ ...prev, ticketQuantity: value }));
            }}
            className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-3 text-lg font-semibold"
          />
          <p className="mt-2 text-xs text-gray-500">Suggested for ${ticketPrice}: {getSuggestedTicketQuantity(ticketPrice)} tickets</p>
        </Panel>}

        {detectedGame && !manualOverrideEnabled && (
          <Panel className="border-amber-300 bg-amber-50 p-4 lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-900">Need to change the detected game details?</p>
                <p className="mt-1 text-xs text-amber-800">Choose Override before adding this pack if the price or ticket quantity is different.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setManualOverrideEnabled(true)}>
                Override Before Adding Pack
              </Button>
            </div>
          </Panel>
        )}

        {/* Add Pack — appears after the optional override action */}
        <Panel className="p-5 lg:col-span-2">
          <Button className="w-full" onClick={handleAddPack} disabled={!shipmentReady || !validBarcode || !gameNumber || !packNumber || detecting || savingPack || atExpectedLimit || (autoStageDetectedPacks && Boolean(detectedGame) && !manualOverrideEnabled)}>
            {detecting ? "Detecting Game..." : "Add to Scanned List"}
          </Button>
          {!shipmentReady && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span>Save shipment details and set the expected pack count before adding packs.</span>
              <Button type="button" variant="outline" size="sm" onClick={previousStep}>Go to shipment details</Button>
            </div>
          )}
          {atExpectedLimit && (
            <p className="mt-3 text-sm font-medium text-amber-700">
              Expected pack limit reached. Continue to review/confirm.
            </p>
          )}
        </Panel>

        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-secondary">Scan several packs, select the rows you want, and add them together.</p>
            <Button type="button" onClick={() => void handleAddSelectedPacks()} disabled={selectedDraftPacks.length === 0 || addingSelected || savingPack || savingPacks}>
              {addingSelected ? "Adding Selected..." : `Add Selected to Shipment${selectedDraftPacks.length ? ` (${selectedDraftPacks.length})` : ""}`}
            </Button>
          </div>
          <ScannedPackTable
            packs={packs}
            removePack={removeScannedPack}
            selectable
            selectedPackIds={selectedPackIds}
            onSelectionChange={setSelectedPackIds}
          />
        </div>

        <div className="space-y-3 border-t border-border pt-4 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <Button variant="secondary" className="w-full" onClick={previousStep}>
              ← Back
            </Button>
            <Button variant="outline" className="w-full" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              className="w-full"
              onClick={() => {
                if (!shipment.id) {
                  alert("Save the shipment details before reviewing it.");
                  previousStep();
                  return;
                }
                nextStep();
              }}
              disabled={packs.length === 0 || savingPacks}
            >
              {savingPacks ? "Saving Packs..." : "Next: Review Shipment →"}
            </Button>
          </div>
        </div>
    </div>
  );
}
