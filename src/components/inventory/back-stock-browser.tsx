"use client";

import { useCallback, useEffect, useState } from "react";
import type { Game, Pack, Shipment } from "@prisma/client";
import { BackStockList } from "@/components/inventory/back-stock-list";

type BackStockPack = Pack & { game: Game; shipment: Shipment | null };

export function BackStockBrowser({
  slots,
  canManageBackstock,
}: {
  slots: Array<{ id: string; slotNumber: string; occupied: boolean }>;
  canManageBackstock: boolean;
}) {
  const [packs, setPacks] = useState<BackStockPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPacks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/packs/back-stock", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "Unable to load back stock.");
        return;
      }
      setPacks(Array.isArray(data) ? data as BackStockPack[] : []);
    } catch {
      setError("Unable to load back stock. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPacks();
  }, [loadPacks]);

  if (loading) return <div className="flex-1 p-5 text-sm text-text-secondary" role="status">Loading back stock…</div>;
  if (error) return <div className="m-5 border border-danger/30 bg-danger-soft p-4 text-sm text-danger-soft-text" role="alert"><p>{error}</p><button type="button" onClick={() => { void loadPacks(); }} className="mt-3 border border-current px-3 py-2 font-semibold">Retry</button></div>;

  return <BackStockList packs={packs} slots={slots} canManageBackstock={canManageBackstock} />;
}
