"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, FileUp, Loader2 } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

type ReportType = "SETTLED_PACK" | "ACTIVATED" | "INVENTORY";

const REPORTS: Array<{ type: ReportType; label: string; fileName: string; headers: string[] }> = [
  { type: "SETTLED_PACK", label: "Scratch Ticket Settled Pack Report", fileName: "scratch-ticket-settled-pack-report-template.csv", headers: ["Game", "Tickets", "Cost", "Game-Pack #", "Date", "Type"] },
  { type: "ACTIVATED", label: "Scratch Ticket Activated Report", fileName: "scratch-ticket-activated-report-template.csv", headers: ["Game", "Tickets", "Cost", "Game-Pack #", "Date", "Type", "Activation Number"] },
  { type: "INVENTORY", label: "Scratch Ticket Inventory Report", fileName: "scratch-ticket-inventory-report-template.csv", headers: ["Game", "Game-Pack #", "Status", "Tickets", "Cost", "Retail Value", "Date"] },
];

interface Store { id: string; name: string }
interface UploadedReport { storeId: string; reportType: ReportType; fileName: string; rowCount: number; uploadedAt: string; imageUrl?: string | null; verificationStatus?: string }

function csvValue(value: string) { return `"${value.replaceAll('"', '""')}"`; }

export function StateReportsUploader() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [uploaded, setUploaded] = useState<UploadedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<ReportType | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [canUpload, setCanUpload] = useState(false);

  async function load() {
    try {
      const response = await fetch("/api/owner/state-reports", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load reports.");
      setStores(data.stores ?? []);
      setSelectedStoreId((current) => current || data.stores?.[0]?.id || "");
      setWeekStart(data.weekStart ?? "");
      setUploaded(data.reports ?? []);
      setCanUpload(data.canUpload === true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selectedReports = useMemo(
    () => uploaded.filter((report) => report.storeId === selectedStoreId),
    [uploaded, selectedStoreId]
  );

  function downloadTemplate(report: typeof REPORTS[number]) {
    const csv = `${report.headers.map(csvValue).join(",")}\n`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = report.fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function upload(reportType: ReportType, file: File | undefined) {
    if (!file || !selectedStoreId) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Files must be 10 MB or smaller.");
      return;
    }
    try {
      setUploading(reportType);
      setUploadingFileName(file.name);
      setMessage("");
      setError("");
      const form = new FormData();
      form.set("storeId", selectedStoreId);
      form.set("reportType", reportType);
      form.set("file", file);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 30_000);
      const response = await fetch("/api/owner/state-reports", { method: "POST", body: form, signal: controller.signal });
      window.clearTimeout(timeout);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to upload report.");
      setMessage(`${file.name} uploaded for this Monday review.`);
      setUploaded((current) => [
        ...current.filter((report) => !(report.storeId === selectedStoreId && report.reportType === reportType)),
        {
          storeId: selectedStoreId,
          reportType,
          fileName: file.name,
          rowCount: Number(data.rowCount ?? 0),
          uploadedAt: new Date().toISOString(),
          imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : null,
          verificationStatus: file.type.startsWith("image/") ? "OCR pending" : "Pending",
        },
      ]);
    } catch (reason) {
      setError(reason instanceof DOMException && reason.name === "AbortError" ? "Upload timed out. Check your connection and try again." : reason instanceof Error ? reason.message : "Unable to upload report.");
    } finally {
      setUploading(null);
      setUploadingFileName("");
    }
  }

  const complete = selectedReports.length === REPORTS.length;

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Weekly controls</p>
          <h2 className="mt-1 text-base font-semibold text-text">State Lottery Report Uploads</h2>
              <p className="mt-1 text-sm text-text-secondary">Upload all three prior-week State Lottery receipts every Monday. Photos are archived for compliance review.</p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
          {selectedReports.length} / 3 complete
        </div>
      </div>

      {loading ? <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Loading report status...</div> : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-soft px-3 py-2">
            <label htmlFor="state-report-store" className="text-xs font-medium text-text-secondary">Store</label>
            <select id="state-report-store" value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value)} className="min-w-[220px] rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text">
              {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select>
            <span className="text-xs text-text-tertiary">Week of Monday {weekStart}</span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {REPORTS.map((report) => {
              const current = selectedReports.find((item) => item.reportType === report.type);
              return (
                <div key={report.type} className="rounded-md border border-border p-3">
                  <p className="text-sm font-semibold text-text">{report.label}</p>
                  <p className="mt-1 text-xs text-text-tertiary">{current ? `${current.imageUrl ? `Photo archived · ${current.verificationStatus ?? "OCR pending"}` : `${current.rowCount} rows`} · ${current.fileName}` : "Required this Monday"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadTemplate(report)} disabled={uploading !== null}><Download size={13} /> Template</Button>
                    {canUpload ? (
                      <label className="flex min-h-24 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-accent/50 bg-accent/5 px-3 py-4 text-center text-xs font-semibold text-accent hover:bg-accent/10">
                        {uploading === report.type ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />}
                        <span>{uploading === report.type ? "Uploading..." : "Take a photo or upload CSV"}<span className="mt-1 block text-[10px] font-normal text-text-tertiary">Upload directly on this page</span></span>
                        <input type="file" accept=".csv,text/csv,image/*" capture="environment" className="sr-only" disabled={uploading !== null} onChange={(event) => { void upload(report.type, event.target.files?.[0]); event.currentTarget.value = ""; }} />
                      </label>
                    ) : <span className="text-xs text-text-tertiary">Manager upload required</span>}
                  </div>
                  {uploading === report.type && <p role="status" className="mt-2 text-xs text-text-secondary">Uploading {uploadingFileName}. Keep this page open.</p>}
                  {current && <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 size={13} /> Uploaded {new Date(current.uploadedAt).toLocaleString()}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}
      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </Panel>
  );
}
