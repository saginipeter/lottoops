"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ReportActions } from "@/components/reports/report-actions";
import { loadShipmentReport } from "@/lib/shipment-report";

interface ShipmentRecord {
  id: string;
  invoiceNumber: string;
  shipmentConfirmationNumber: string | null;
  shipmentDate: string | null;
  expectedPacks: number;
  scannedPacks: number;
  status: string;
  createdAt: string;
  receivedBy: { name: string };
  _count: { packs: number };
}

interface ShipmentPage {
  shipments: ShipmentRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function ReceivingShipmentsReport() {
  const [result, setResult] = useState<ShipmentPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (requestedPage: number) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/shipments?page=${requestedPage}`, { cache: "no-store" });
      const data = await response.json() as ShipmentPage & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load shipment records.");
      setResult(data);
      setPage(data.page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load shipment records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(1); }, [load]);

  const shipments = result?.shipments ?? [];
  const firstRecord = result && result.total > 0 ? (page - 1) * result.pageSize + 1 : 0;
  const lastRecord = result ? Math.min(page * result.pageSize, result.total) : 0;

  return <Panel className="p-4 sm:p-5">
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Inventory history</p>
        <h2 className="mt-1 text-lg font-semibold text-text">Receiving Shipment Records</h2>
        <p className="mt-1 text-sm text-text-secondary">Historical shipments for this store, including receiver and pack totals.</p>
      </div>
      <div className="flex gap-2 print:hidden">
        <Button variant="outline" onClick={() => void load(page)} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>
    </header>

    {error && <p role="alert" className="mb-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {loading ? <div className="flex items-center gap-2 py-10 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Loading shipment records…</div> : (
      <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="py-2 pr-3">Shipment date</th><th className="py-2 pr-3">Invoice</th><th className="py-2 pr-3">Confirmation</th><th className="py-2 pr-3">Received by</th><th className="py-2 pr-3 text-right">Expected packs</th><th className="py-2 pr-3 text-right">Recorded packs</th><th className="py-2">Status</th><th className="py-2">Report</th>
            </tr></thead>
            <tbody>
              {shipments.map((shipment) => <tr key={shipment.id} className="border-b border-border last:border-0">
                <td className="py-2.5 pr-3">{shipment.shipmentDate ? new Date(shipment.shipmentDate).toLocaleDateString() : new Date(shipment.createdAt).toLocaleDateString()}</td>
                <td className="py-2.5 pr-3 font-mono">{shipment.invoiceNumber}</td>
                <td className="py-2.5 pr-3 font-mono">{shipment.shipmentConfirmationNumber || "—"}</td>
                <td className="py-2.5 pr-3">{shipment.receivedBy?.name || "Not recorded"}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{shipment.expectedPacks}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{shipment._count?.packs ?? shipment.scannedPacks}</td>
                <td className="py-2.5">{shipment.status.replaceAll("_", " ")}</td>
                <td className="py-2.5"><ReportActions loadDocument={() => loadShipmentReport(shipment.id)} /></td>
              </tr>)}
              {shipments.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-sm text-text-secondary">No shipment records found.</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 print:hidden">
          <p className="text-xs text-text-secondary">Showing {firstRecord}–{lastRecord} of {result?.total ?? 0} shipments</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load(page - 1)} disabled={loading || page <= 1}><ChevronLeft size={14} />Previous</Button>
            <Button variant="outline" size="sm" onClick={() => void load(page + 1)} disabled={loading || page >= (result?.totalPages ?? 1)}>Next<ChevronRight size={14} /></Button>
          </div>
        </footer>
      </>
    )}
  </Panel>;
}