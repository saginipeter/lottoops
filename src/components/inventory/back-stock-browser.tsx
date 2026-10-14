"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game, Pack, Shipment } from "@prisma/client";
import { BackStockList } from "@/components/inventory/back-stock-list";

type BackStockPack = Pack & { game: Game; shipment: Shipment | null };

export function BackStockBrowser({
  canManageBackstock,
}: {
  canManageBackstock: boolean;
}) {
  const [packs, setPacks] = useState<BackStockPack[]>([]);
  const [slots, setSlots] = useState<Array<{ id: string; slotNumber: string; occupied: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const activeRequest = useRef<AbortController | null>(null);

  const loadPacks = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    setLoading(true);
    setError("");
    try {
      const load = async (url: string) => {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to load back stock.");
        if (!Array.isArray(data)) throw new Error("Invalid inventory response. Please retry.");
        return data;
      };
      const [packData, slotData] = await Promise.all([
        load("/api/packs/back-stock"),
        load("/api/display-slots"),
      ]);
      if (activeRequest.current !== controller) return;
      setPacks(packData as BackStockPack[]);
      setSlots(slotData.map((slot: { id: string; slotNumber: string; packId: string | null }) => ({
        id: slot.id, slotNumber: slot.slotNumber, occupied: Boolean(slot.packId),
      })));
    } catch (reason) {
      if (activeRequest.current !== controller) return;
      setError(controller.signal.aborted
        ? "Loading back stock timed out. Check your connection and retry."
        : reason instanceof Error ? reason.message : "Unable to load back stock. Check your connection and retry.");
    } finally {
      window.clearTimeout(timeout);
      controller.abort();
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadPacks();
    return () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [loadPacks]);

  if (loading) return <div className="flex-1 p-5 text-sm text-text-secondary" role="status">Loading back stock…</div>;
  if (error) return <div className="m-5 border border-danger/30 bg-danger-soft p-4 text-sm text-danger-soft-text" role="alert"><p>{error}</p><button type="button" onClick={() => { void loadPacks(); }} className="mt-3 border border-current px-3 py-2 font-semibold">Retry</button></div>;

  return <BackStockList packs={packs} slots={slots} canManageBackstock={canManageBackstock} />;
}
