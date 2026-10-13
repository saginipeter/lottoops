"use client";

import { useMemo, useState } from "react";
import { Eye, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { renderReportDocument, type ReportDocument } from "@/lib/report-document";

export function ReportActions({ document, disabled = false }: { document: ReportDocument | (() => Promise<ReportDocument>); disabled?: boolean }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [printJob, setPrintJob] = useState<{ html: string; id: number } | null>(null);
  const [loadedDocument, setLoadedDocument] = useState<ReportDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const report = typeof document === "function" ? loadedDocument : document;
  const html = useMemo(() => report ? renderReportDocument(report) : "", [report]);

  function queuePrint(html: string) {
    // Keep the source alive for asynchronous print jobs; replace it on the next print.
    setPrintJob((previous) => ({ html, id: (previous?.id ?? 0) + 1 }));
  }

  async function openReport(action: "view" | "print") {
    setError("");
    setLoading(true);
    try {
      const nextReport = typeof document === "function" ? await document() : document;
      setLoadedDocument(nextReport);
      if (action === "view") setPreviewOpen(true);
      else queuePrint(renderReportDocument(nextReport));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load the report. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" onClick={() => void openReport("view")} disabled={disabled || loading}>
        <Eye size={14} /> View Report
      </Button>
      <Button type="button" variant="secondary" onClick={() => void openReport("print")} disabled={disabled || loading}>
        <Printer size={14} /> Print Report
      </Button>
      {loading && <span role="status" className="inline-flex items-center gap-1 text-xs"><Loader2 size={14} className="animate-spin" /> Loading report…</span>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90dvh] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{report?.title ?? "Report"}</DialogTitle>
            <DialogDescription>Document preview — only report data is included in the printout.</DialogDescription>
          </DialogHeader>
          <iframe title={`${report?.title ?? "Report"} preview`} sandbox="" srcDoc={html} className="h-[65dvh] w-full border border-border bg-white" />
          <Button type="button" onClick={() => queuePrint(html)} disabled={disabled || loading || !report}><Printer size={14} /> Print Report</Button>
        </DialogContent>
      </Dialog>
      {printJob !== null && (
        <iframe
          key={printJob.id}
          title={`${report?.title ?? "Report"} print document`}
          sandbox="allow-same-origin allow-modals"
          srcDoc={printJob.html}
          aria-hidden="true"
          tabIndex={-1}
          className="fixed -left-[10000px] top-0 h-px w-px border-0"
          onLoad={(event) => {
            const printWindow = event.currentTarget.contentWindow;
            if (!printWindow) {
              setPrintJob(null);
              setError("Unable to open the print document. Please try again.");
              return;
            }
            try {
              printWindow.focus();
              printWindow.print();
            } catch {
              setPrintJob(null);
              setError("Printing is unavailable in this browser. Please try another browser.");
            }
          }}
        />
      )}
    </div>
  );
}
