"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { formatCurrency } from "@/lib/utils";
import { ScanInput } from "./scan-input";
import { BatchList, type ScannedPack } from "./batch-list";
import {
  AlertCircle,
  CheckCircle2,
  PackageCheck,
  Volume2,
  VolumeX,
  ScanLine,
  Loader2,
} from "lucide-react";

type FeedbackState =
  | { type: "idle" }
  | { type: "success"; serial: string; gameName: string }
  | { type: "duplicate"; serial: string }
  | { type: "unrecognized"; serial: string }
  | { type: "wrong-game"; serial: string; expected: string; got: string }
  | { type: "error"; message: string };

export function ReceiveScanSession() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [cost, setCost] = useState("");
  const [batch, setBatch] = useState<ScannedPack[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: "idle" });
  const [soundOn, setSoundOn] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadGames() {
      try {
        const res = await fetch("/api/games");
        if (!res.ok) throw new Error("Failed to load games");
        const data = await res.json();
        if (!cancelled) setGames(data.games ?? []);
      } catch {
        if (!cancelled) {
          showFeedback({
            type: "error",
            message: "Couldn't load games. Refresh and try again.",
          });
        }
      } finally {
        if (!cancelled) setGamesLoading(false);
      }
    }
    loadGames();
    return () => {
      cancelled = true;
    };

  }, []);


  const retailValuePerPack = activeGame
    ? Number(activeGame.price) * activeGame.ticketsPerPack
    : 0;
  const batchTotal = batch.length * retailValuePerPack;
  const batchCostTotal = batch.length * (parseFloat(cost) || 0);

  const playTone = useCallback(
    (kind: "success" | "error") => {
      if (!soundOn) return;
      try {
        const ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = kind === "success" ? 880 : 220;
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + (kind === "success" ? 0.12 : 0.25)
        );
        osc.start();
        osc.stop(ctx.currentTime + (kind === "success" ? 0.12 : 0.25));
      } catch {
        // Audio not available — silently skip, visual feedback still shows.
      }
    },
    [soundOn]
  );

  function showFeedback(next: FeedbackState) {
    setFeedback(next);
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    feedbackTimeout.current = setTimeout(
      () => setFeedback({ type: "idle" }),
      2600
    );
  }

  async function handleScan(serial: string) {
    if (batch.some((b) => b.serialNumber === serial)) {
      showFeedback({ type: "duplicate", serial });
      playTone("error");
      return;
    }

    setChecking(true);
    try {
      const res = await fetch("/api/packs/check-serial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialNumber: serial }),
      });

      if (!res.ok) {
        showFeedback({
          type: "error",
          message: "Couldn't check that serial — try again.",
        });
        playTone("error");
        return;
      }

      const data = await res.json();

      if (data.status === "duplicate") {
        showFeedback({ type: "duplicate", serial });
        playTone("error");
        return;
      }

      if (data.status === "unrecognized") {
        showFeedback({ type: "unrecognized", serial });
        playTone("error");
        return;
      }

      const detectedGame: Game = data.game;

      if (!activeGame) {
        setActiveGame(detectedGame);
        setBatch([{ serialNumber: serial, scannedAt: new Date().toISOString() }]);
        showFeedback({ type: "success", serial, gameName: detectedGame.name });
        playTone("success");
        return;
      }

      if (detectedGame.id !== activeGame.id) {
        showFeedback({
          type: "wrong-game",
          serial,
          expected: activeGame.name,
          got: detectedGame.name,
        });
        playTone("error");
        return;
      }

      setBatch((prev) => [
        ...prev,
        { serialNumber: serial, scannedAt: new Date().toISOString() },
      ]);
      showFeedback({ type: "success", serial, gameName: detectedGame.name });
      playTone("success");
    } catch {
      showFeedback({
        type: "error",
        message: "Network error — check your connection and try again.",
      });
      playTone("error");
    } finally {
      setChecking(false);
    }
  }

  function handleRemove(serial: string) {
    const next = batch.filter((p) => p.serialNumber !== serial);
    setBatch(next);
    if (next.length === 0) setActiveGame(null);
  }

  function handleManualGameOverride(gameId: string) {
    const game = games.find((g) => g.id === gameId) ?? null;
    setActiveGame(game);
    setBatch([]);
  }

  async function handleSaveBatch() {
    if (batch.length === 0 || !activeGame) return;
    setSaving(true);
    try {
      const res = await fetch("/api/packs/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: activeGame.id,
          costPerPack: parseFloat(cost),
          serialNumbers: batch.map((b) => b.serialNumber),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showFeedback({
          type: "error",
          message: data.error ?? "Failed to save batch.",
        });
        setSaving(false);
        return;
      }

      setSaving(false);
      setSaved(true);
      setTimeout(() => router.push("/inventory"), 1000);
    } catch {
      showFeedback({
        type: "error",
        message: "Network error while saving — your batch was not saved.",
      });
      setSaving(false);
    }
  }

  const canScan = cost.trim() !== "" && !gamesLoading;

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 flex flex-col gap-6">
        <Panel className="scan-line p-5">
          <h3 className="mb-4 text-sm font-semibold text-text">
            1. Set the cost for this delivery
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                Game
                <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-medium text-accent-soft-text">
                  auto-detected from scan
                </span>
              </label>
              <select
                value={activeGame?.id ?? ""}
                onChange={(e) => handleManualGameOverride(e.target.value)}
                disabled={gamesLoading}
                className="w-full rounded-md border border-border bg-surface-soft px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
              >
                <option value="">
                  {gamesLoading ? "Loading games…" : "Scan a pack to detect…"}
                </option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    #{g.gameNumber} — {g.name} ({formatCurrency(Number(g.price))})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Cost per pack
              </label>
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full rounded-md border border-border bg-surface-soft px-3 py-2.5 font-mono text-sm text-text placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>
          {!canScan && !gamesLoading && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-text-tertiary">
              <ScanLine size={12} />
              Enter the pack cost, then just start scanning — the game is
              identified automatically from the first pack.
            </p>
          )}
        </Panel>

        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">2. Scan packs</h3>
            <button
              onClick={() => setSoundOn((v) => !v)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-tertiary hover:bg-surface-soft hover:text-text-secondary transition-colors"
              title={soundOn ? "Mute scan sounds" : "Unmute scan sounds"}
            >
              {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {soundOn ? "Sound on" : "Sound off"}
            </button>



          </div>

          <ScanInput
            onScan={handleScan}
            disabled={!canScan || saved || checking}
            placeholder={
              !canScan
                ? "Enter pack cost above first"
                : checking
                ? "Checking…"
                : undefined
            }
          />

          <div className="mt-2 min-h-[34px]">
            {checking && (
              <div className="flex items-center gap-1.5 rounded-md bg-surface-soft px-3 py-2 text-xs text-text-secondary">
                <Loader2 size={13} className="animate-spin" />
                Checking serial number…
              </div>
            )}
            {!checking && feedback.type === "success" && (
              <div className="flex items-center gap-1.5 rounded-md bg-success-soft px-3 py-2 text-xs text-success-soft-text">
                <CheckCircle2 size={13} />
                Added {feedback.serial} — {feedback.gameName}
              </div>
            )}
            {!checking && feedback.type === "duplicate" && (
              <div className="flex items-center gap-1.5 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-soft-text">
                <AlertCircle size={13} />
                {feedback.serial} is already in the system or this batch — skipped
              </div>
            )}
            {!checking && feedback.type === "unrecognized" && (
              <div className="flex items-center gap-1.5 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-soft-text">
                <AlertCircle size={13} />
                Game number not recognized for {feedback.serial} — add the
                game first, or check the barcode
              </div>
            )}
            {!checking && feedback.type === "wrong-game" && (
              <div className="flex items-center gap-1.5 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-soft-text">
                <AlertCircle size={13} />
                {feedback.serial} is {feedback.got}, but this batch is for{" "}
                {feedback.expected} — start a new batch for a different game
              </div>
            )}
            {!checking && feedback.type === "error" && (
              <div className="flex items-center gap-1.5 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-soft-text">
                <AlertCircle size={13} />
                {feedback.message}
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-text">
              3. Review and save
            </h3>
          </div>
          <BatchList
            items={batch}
            gameName={activeGame?.name ?? ""}
            retailValuePerPack={retailValuePerPack}
            onRemove={handleRemove}
          />
        </Panel>
      </div>

      <div>
        <Panel className="sticky top-0 p-6">
          <h3 className="text-sm font-semibold text-text">Batch summary</h3>
          <div className="perf-divider mt-4" />
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-secondary">Game</dt>
              <dd className="text-right text-text">
                {activeGame ? activeGame.name : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Game #</dt>
              <dd className="font-mono text-text">
                {activeGame ? activeGame.gameNumber : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Price / ticket</dt>
              <dd className="font-mono text-text">
                  {activeGame ? formatCurrency(Number(activeGame.price)) : "—"}              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Tickets / pack</dt>
              <dd className="font-mono text-text">
                {activeGame ? activeGame.ticketsPerPack : "—"}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <dt className="text-text-secondary">Packs scanned</dt>
              <dd className="font-mono text-text">{batch.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Cost (batch total)</dt>
              <dd className="font-mono text-text">
                {formatCurrency(batchCostTotal)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <dt className="text-text-secondary">Retail value</dt>
              <dd className="font-mono font-semibold text-accent">
                {formatCurrency(batchTotal)}
              </dd>
            </div>
          </dl>

          <Button
            variant="default"
            className="mt-5 w-full justify-center"
            disabled={batch.length === 0 || saving || saved}
            onClick={handleSaveBatch}
          >
            {saved ? (
              <>
                <PackageCheck size={15} />
                Saved to back stock
              </>
            ) : saving ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Saving…
              </>
            ) : (
              `Save ${batch.length || ""} pack${batch.length !== 1 ? "s" : ""} to back stock`
            )}
          </Button>

          <p className="mt-3 text-xs leading-relaxed text-text-tertiary">
            Packs are saved as back stock once you save the batch. Activate
            them to a display slot when you are ready to put them on the
            board.
          </p>
        </Panel>
      </div>
    </div>
  );
}