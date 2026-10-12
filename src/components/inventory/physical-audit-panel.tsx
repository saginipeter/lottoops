"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface AuditLine {
  id: string;
  packId?: string;
  slotNumber?: string;
  expectedTicket?: number;
  endingExpectedTicket?: number | null;
  variance?: number | null;
  beginningPhysicalTicket: number | null;
  endingPhysicalTicket: number | null;
  pack?: { serialNumber: string; game: { name: string } };
}

interface AuditState {
  id: string;
  status: string;
  lines: AuditLine[];
}

export default function PhysicalAuditPanel({ shiftId, audit, activeDisplayPackCount }: { shiftId: string; audit?: AuditState; activeDisplayPackCount: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"beginning" | "ending">("beginning");
  const [barcode, setBarcode] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [localLines, setLocalLines] = useState<AuditLine[]>(audit?.lines ?? []);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setLocalLines(audit?.lines ?? []), [audit]);
  const lines = useMemo(() => localLines, [localLines]);
  const scanned = useMemo(() => lines.filter((line) => phase === "beginning" ? line.beginningPhysicalTicket !== null : line.endingPhysicalTicket !== null).length, [lines, phase]);
  // An empty display has nothing to reconcile. Treat 0/0 as complete so the
  // shift can move directly to closing without requiring a phantom scan.
  const beginningComplete = activeDisplayPackCount === 0 || lines.filter((line) => line.beginningPhysicalTicket !== null).length === activeDisplayPackCount;
  const varianceLines = lines.filter((line) => line.endingPhysicalTicket !== null && Number(line.variance ?? 0) !== 0);
  const shortCount = varianceLines.reduce((sum, line) => sum + Math.max(-Number(line.variance ?? 0), 0), 0);
  const overCount = varianceLines.reduce((sum, line) => sum + Math.max(Number(line.variance ?? 0), 0), 0);

  async function beginAudit() {
    const response = await fetch("/api/inventory-audits/begin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shiftId }) });
    if (!response.ok) { setMessageType("error"); setMessage((await response.json()).error ?? "Unable to begin audit."); return; }
    window.location.reload();
  }

  async function scan() {
    if (!barcode.trim() || !audit) return;
    const response = await fetch("/api/inventory-audits/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId: audit.id, serialNumber: barcode.trim(), phase }) });
    const data = await response.json();
    setMessageType(response.ok ? "success" : "error");
    setMessage(response.ok ? "Audit scan recorded." : data.error ?? "Unable to record audit scan.");
    if (response.ok) {
      setLocalLines((current) => {
        const index = current.findIndex((line) => line.id === data.id);
        if (index === -1) return [...current, data];
        return current.map((line) => line.id === data.id ? data : line);
      });
      setBarcode("");
      router.refresh();
    }
    inputRef.current?.focus();
  }

  async function completeAudit() {
    if (!audit) return;
    const response = await fetch("/api/inventory-audits/end", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId: audit.id }) });
    const data = await response.json();
    if (!response.ok) { setMessageType("error"); setMessage(data.error ?? "Unable to complete audit."); return; }
    window.location.reload();
  }

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-base font-semibold">Physical Inventory Audit</h3><p className="text-xs text-text-tertiary">Scan each display pack. Audit scans do not record sales.</p></div>
      {!audit && <Button onClick={beginAudit}>Begin Opening Audit</Button>}
      </div>
      {audit && audit.status === "OPEN" && <>
        <div className="mt-3 flex items-center gap-2"><Button size="sm" variant={phase === "beginning" ? "secondary" : "ghost"} onClick={() => setPhase("beginning")}>Opening Audit</Button><Button size="sm" variant={phase === "ending" ? "secondary" : "ghost"} disabled={!beginningComplete} onClick={() => setPhase("ending")}>Closing Audit</Button><span className={`text-sm font-medium ${scanned === activeDisplayPackCount ? "text-emerald-700" : "text-text-secondary"}`}>{phase === "beginning" ? "Opening" : "Closing"}: {scanned}/{activeDisplayPackCount} Scanned{scanned === activeDisplayPackCount ? " (Complete)" : ""}</span></div>
        {!beginningComplete && <p className="mt-2 text-xs font-medium text-amber-700">Complete the Opening Audit first. The Closing Audit becomes available afterward.</p>}
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><input ref={inputRef} autoFocus value={barcode} inputMode="numeric" onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void scan(); } }} placeholder={phase === "beginning" ? "Scan the current ticket for the Opening Audit" : "Scan the current ticket for the Closing Audit"} className="min-w-0 rounded-md border-2 border-border px-3 py-3 font-mono text-lg tracking-wider" /><Button onClick={() => { void scan(); }} disabled={!barcode.trim()}>Record {phase === "beginning" ? "Opening" : "Closing"} Scan</Button></div>
        <p className="mt-2 text-xs text-text-tertiary">{phase === "beginning" ? "Opening Audit: record the ticket currently on each display before sales begin." : "Closing Audit: record the ticket currently on each display before closing the shift."} Use one complete 14-digit ticket barcode.</p>
        <Button className="mt-3" variant="outline" disabled={phase !== "ending" || scanned !== activeDisplayPackCount} onClick={completeAudit}>Complete Closing Audit</Button>
      </>}
      {audit?.status === "COMPLETED" && <section className="mt-4 border border-border bg-surface-soft p-4" aria-label="Physical audit variance report">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h4 className="text-sm font-bold text-text">Physical audit reconciliation</h4><p className="mt-1 text-xs text-text-secondary">Observed closing ticket compared with the system ticket after recorded sales.</p></div>
          <span className={`border px-2 py-1 text-xs font-bold ${varianceLines.length ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
            {varianceLines.length ? `${varianceLines.length} pack variance${varianceLines.length === 1 ? "" : "s"}` : "All packs reconciled"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div className="border border-border bg-surface p-2"><span className="text-text-tertiary">Packs checked</span><strong className="ml-2 text-text">{lines.length}</strong></div>
          <div className="border border-border bg-surface p-2"><span className="text-text-tertiary">Short</span><strong className="ml-2 text-red-700">{shortCount}</strong></div>
          <div className="border border-border bg-surface p-2"><span className="text-text-tertiary">Over</span><strong className="ml-2 text-amber-700">{overCount}</strong></div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead><tr className="border-b border-border text-text-tertiary"><th className="py-2 pr-3">Display / Pack</th><th className="py-2 pr-3">System expected</th><th className="py-2 pr-3">Observed</th><th className="py-2">Difference</th></tr></thead>
            <tbody>{lines.map((line) => {
              const expected = Number(line.endingExpectedTicket ?? line.expectedTicket ?? 0);
              const observed = Number(line.endingPhysicalTicket ?? 0);
              const variance = observed - expected;
              return <tr key={line.id} className="border-b border-border/70">
                <td className="py-2 pr-3"><span className="font-semibold text-text">Display {line.slotNumber ?? "—"}</span><span className="ml-2 text-text-secondary">{line.pack?.game.name ?? "Pack"} #{line.pack?.serialNumber ?? line.packId ?? "—"}</span></td>
                <td className="py-2 pr-3 tabular-nums">{expected}</td><td className="py-2 pr-3 tabular-nums">{observed}</td>
                <td className={`py-2 font-bold tabular-nums ${variance < 0 ? "text-red-700" : variance > 0 ? "text-amber-700" : "text-emerald-700"}`}>{variance > 0 ? `+${variance}` : variance}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {varianceLines.length > 0 && <p className="mt-3 text-xs font-medium text-amber-800">Review each flagged pack before resolving the variance. Variance equals observed physical ticket minus system-expected physical ticket.</p>}
      </section>}
      {message && <p role="status" className={`mt-2 text-sm ${messageType === "success" ? "text-emerald-700" : "text-red-700"}`}>{message}</p>}
    </Panel>
  );
}
