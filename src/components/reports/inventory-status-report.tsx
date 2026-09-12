"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

type PackStatus = "ALL" | "BACK_STOCK" | "ACTIVE" | "RETURNED" | "SOLD_OUT" | "COMPLETED";

interface PackRow {
  id: string;
  serialNumber: string;
  gameNumber?: string | null;
  packNumber?: string | null;
  status: PackStatus;
  ticketPrice?: string | number | null;
  ticketQuantity?: number | null;
  retailValue: string | number;
  removalReason?: string | null;
  activeRemovalReason?: string | null;
  game: { name: string };
  slot?: { slotNumber: string } | null;
}

export function InventoryStatusReport() {
  const [status, setStatus] = useState<PackStatus>("ALL");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PackRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ status });
        if (q.trim()) params.set("q", q.trim());
        const res = await fetch(`/api/reports/inventory-status?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load inventory status.");
        if (!active) return;
        setRows(data.packs ?? []);
        setCounts(data.counts ?? {});
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load inventory status.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [status, q]);

  const totalRetail = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.retailValue ?? 0), 0),
    [rows]
  );

  return (
    <Panel className="p-4">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <p className="text-xs font-semibold uppercase text-text-tertiary">Inventory Status Report</p>
          <p className="text-sm text-text-secondary">Combined status of all packs with filters.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PackStatus)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
          >
            {["ALL", "BACK_STOCK", "ACTIVE", "RETURNED", "SOLD_OUT", "COMPLETED"].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search game, pack, serial..."
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
          />
          <Button variant="outline" onClick={() => window.open("/api/reports/export?type=inventory", "_blank")}>
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {error && <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-3 flex flex-wrap gap-2 text-xs text-text-secondary">
        {Object.entries(counts).map(([key, value]) => (
          <span key={key} className="rounded-full bg-surface-soft px-2 py-1">
            {key.replaceAll("_", " ")}: {value}
          </span>
        ))}
        <span className="rounded-full bg-surface-soft px-2 py-1 font-semibold text-text">
          Filtered Retail Value: ${totalRetail.toFixed(2)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Game</th>
              <th className="py-2 pr-3">Display #</th>
              <th className="py-2 pr-3">Pack #</th>
              <th className="py-2 pr-3">Serial</th>
              <th className="py-2 pr-3 text-right">Qty</th>
              <th className="py-2 pr-3 text-right">Retail Value</th>
              <th className="py-2 pr-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-text-secondary">
                  No packs found for this filter.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border">
                <td className="py-2 pr-3">{row.status.replaceAll("_", " ")}</td>
                <td className="py-2 pr-3">
                  {row.game.name}
                  <span className="ml-1 text-xs text-text-tertiary">#{row.gameNumber ?? "—"}</span>
                </td>
                <td className="py-2 pr-3">{row.slot?.slotNumber ?? "—"}</td>
                <td className="py-2 pr-3">{row.packNumber ?? "—"}</td>
                <td className="py-2 pr-3 text-xs">{row.serialNumber}</td>
                <td className="py-2 pr-3 text-right">{row.ticketQuantity ?? 0}</td>
                <td className="py-2 pr-3 text-right">${Number(row.retailValue).toFixed(2)}</td>
                <td className="py-2 pr-3">{row.activeRemovalReason ?? row.removalReason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
