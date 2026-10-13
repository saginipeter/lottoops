"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ReportActions } from "@/components/reports/report-actions";
import { buildReceivingReportDocument, type ReceivingShipmentReport } from "@/lib/receiving-report-document";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<ReceivingShipmentReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportRequest, setReportRequest] = useState(0);

  const load = useCallback(async (requestedPage: number) => {
    setLoading(true);
    setError("");
    setSelectedId(null);
    setSelectedShipment(null);
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

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    async function loadReport() {
      setReportLoading(true);
      setReportError("");
      setSelectedShipment(null);
      try {
        const response = await fetch(`/api/shipments/${encodeURIComponent(selectedId!)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json() as ReceivingShipmentReport & { error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load shipment report.");
        if (!controller.signal.aborted) setSelectedShipment(data);
      } catch (reason) {
        if (!controller.signal.aborted) setReportError(reason instanceof Error ? reason.message : "Unable to load shipment report.");
      } finally {
        if (!controller.signal.aborted) setReportLoading(false);
      }
    }
    void loadReport();
    return () => controller.abort();
  }, [selectedId, reportRequest]);

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
    {selectedId && <section aria-label="Selected receiving report" aria-live="polite" className="mb-4 border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold">Receiving transaction report{selectedShipment ? ` — Invoice ${selectedShipment.invoiceNumber}` : ""}</h3>
        <Button variant="outline" size="sm" onClick={() => { setSelectedId(null); setSelectedShipment(null); }}>Close</Button>
      </div>
      {reportLoading && <p className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" />Loading pack line items…</p>}
      {reportError && <p role="alert" className="text-sm text-red-700">{reportError} Select another record or refresh to try again.</p>}
      {selectedShipment && <ReportActions document={buildReceivingReportDocument(selectedShipment)} />}
    </section>}
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
                <td className="py-2.5 pr-3">{shipment.receivedBy?.name || "Unknown"}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{shipment.expectedPacks}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{shipment._count?.packs ?? shipment.scannedPacks}</td>
                <td className="py-2.5">{shipment.status.replaceAll("_", " ")}</td>
                <td className="py-2.5"><Button variant="outline" size="sm" aria-label={`Open receiving report for invoice ${shipment.invoiceNumber}`} disabled={selectedId === shipment.id && reportLoading} onClick={() => { setSelectedShipment(null); setReportError(""); setReportLoading(true); setSelectedId(shipment.id); setReportRequest((request) => request + 1); }}>Open report</Button></td>
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