"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export default function PhysicalAuditPanel({ shiftId, audit }: { shiftId: string; audit?: any }) {
  const [phase, setPhase] = useState<"beginning" | "ending">("beginning");
  const [barcode, setBarcode] = useState("");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const lines = audit?.lines ?? [];
  const scanned = useMemo(() => lines.filter((line: any) => phase === "beginning" ? line.beginningPhysicalTicket !== null : line.endingPhysicalTicket !== null).length, [lines, phase]);
  const beginningComplete = lines.length > 0 && lines.every((line: any) => line.beginningPhysicalTicket !== null);

  async function beginAudit() {
    const response = await fetch("/api/inventory-audits/begin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shiftId }) });
    if (!response.ok) { setMessage((await response.json()).error ?? "Unable to begin audit."); return; }
    window.location.reload();
  }

  async function scan() {
    if (!barcode.trim() || !audit) return;
    const response = await fetch("/api/inventory-audits/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId: audit.id, serialNumber: barcode.trim(), phase }) });
    const data = await response.json();
    setMessage(response.ok ? "Audit scan recorded." : data.error ?? "Unable to record audit scan.");
    if (response.ok) setBarcode("");
    inputRef.current?.focus();
  }

  async function completeAudit() {
    if (!audit) return;
    const response = await fetch("/api/inventory-audits/end", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId: audit.id }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Unable to complete audit."); return; }
    window.location.reload();
  }

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-base font-semibold">Physical Inventory Audit</h3><p className="text-xs text-text-tertiary">Scan each display pack. Audit scans do not record sales.</p></div>
        {!audit && <Button onClick={beginAudit}>Begin Audit</Button>}
      </div>
      {audit && audit.status === "OPEN" && <>
        <div className="mt-3 flex items-center gap-2"><Button size="sm" variant={phase === "beginning" ? "secondary" : "ghost"} onClick={() => setPhase("beginning")}>Beginning</Button><Button size="sm" variant={phase === "ending" ? "secondary" : "ghost"} disabled={!beginningComplete} onClick={() => setPhase("ending")}>Ending</Button><span className="text-sm text-text-secondary">{scanned} / {lines.length} scanned</span></div>
        <div className="mt-3 flex gap-2"><input ref={inputRef} autoFocus value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); scan(); } }} placeholder="Scan display pack barcode" className="min-w-0 flex-1 rounded-md border-2 border-border px-3 py-3 font-mono" /><Button onClick={scan} disabled={!barcode.trim()}>Record Scan</Button></div>
        <Button className="mt-3" variant="outline" disabled={phase !== "ending" || scanned !== lines.length} onClick={completeAudit}>Complete Ending Audit</Button>
      </>}
      {audit?.status === "COMPLETED" && <p className="mt-3 text-sm font-semibold text-emerald-700">Audit completed. Manager review is required for any variance.</p>}
      {message && <p role="status" className="mt-2 text-sm text-red-700">{message}</p>}
    </Panel>
  );
}