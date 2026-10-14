"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { renderReportDocument, type ReportDocument } from "@/lib/report-document";

export function ReportActions({ document: report, loadDocument, disabled = false }: {
  document?: ReportDocument;
  loadDocument?: () => Promise<ReportDocument>;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<ReportDocument | null>(null);
  const [printing, setPrinting] = useState<ReportDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const printFrame = useRef<HTMLIFrameElement>(null);
  const disposePrint = useRef<(() => void) | null>(null);
  const loadedSnapshot = useRef<ReportDocument | null>(null);
  const preparing = useRef(false);

  useEffect(() => () => {
    disposePrint.current?.();
  }, []);

  async function prepare(action: "view" | "print") {
    if (preparing.current) return;
    preparing.current = true;
    setBusy(true);
    setError("");
    try {
      const result = report ?? loadedSnapshot.current ?? (loadDocument ? await loadDocument() : undefined);
      if (!result) throw new Error("Report data is unavailable.");
      loadedSnapshot.current = result;
      if (action === "view") setPreview(result);
      else setPrinting(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to generate report.");
    } finally { preparing.current = false; setBusy(false); }
  }

  function printLoadedDocument() {
    if (disposePrint.current) return;
    const frameWindow = printFrame.current?.contentWindow;
    if (!frameWindow) { setError("Unable to open print document."); setPrinting(null); return; }
    const printMedia = frameWindow.matchMedia("print");
    let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
    const dispose = () => {
      if (cleanupTimer) clearTimeout(cleanupTimer);
      frameWindow.removeEventListener("afterprint", finish);
      window.removeEventListener("afterprint", finish);
      window.removeEventListener("focus", onFocus);
      printMedia.removeEventListener("change", onPrintMediaChange);
      disposePrint.current = null;
    };
    // Let the browser close its print dialog before removing the print frame.
    const finish = () => {
      if (cleanupTimer) clearTimeout(cleanupTimer);
      cleanupTimer = setTimeout(() => {
        cleanupTimer = null;
        if (printMedia.matches) return;
        dispose();
        if (document.activeElement === printFrame.current) {
          (document.activeElement as HTMLIFrameElement).blur();
        }
        setPrinting(null);
      }, 0);
    };
    const onFocus = () => { if (!printMedia.matches) finish(); };
    const onPrintMediaChange = () => { if (!printMedia.matches) finish(); };
    disposePrint.current = dispose;
    frameWindow.addEventListener("afterprint", finish);
    window.addEventListener("afterprint", finish);
    window.addEventListener("focus", onFocus);
    printMedia.addEventListener("change", onPrintMediaChange);
    try {
      frameWindow.print();
      // Blocking print implementations may return without emitting afterprint.
      if (!printMedia.matches && document.hasFocus()) finish();
    } catch {
      dispose();
      setError("Printing is unavailable in this browser. Try viewing the report.");
      setPrinting(null);
    }
  }

  return <div className="inline-flex flex-wrap items-center gap-2">
    <Button size="sm" variant="outline" disabled={disabled || busy || !!printing} onClick={() => { void prepare("view"); }}><Eye size={14} />View Report</Button>
    <Button size="sm" variant="secondary" disabled={disabled || busy || !!printing} onClick={() => { void prepare("print"); }}><Printer size={14} />Print Report</Button>
    {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
      <DialogContent className="h-[85vh] max-w-[calc(100%-2rem)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-5xl" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{preview?.title ?? "Report preview"}</DialogTitle></DialogHeader>
        {preview && <iframe title={`${preview.title} preview`} sandbox="" srcDoc={renderReportDocument(preview)} className="h-full min-h-0 w-full flex-1 border border-border bg-white" />}
      </DialogContent>
    </Dialog>
    {printing && <iframe ref={printFrame} title="Print report document" sandbox="allow-same-origin allow-modals" srcDoc={renderReportDocument(printing)} onLoad={printLoadedDocument} className="fixed -left-[10000px] top-0 h-px w-px border-0" />}
  </div>;
}
