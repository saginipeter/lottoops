"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface AuditLine {
  id: string;
  beginningPhysicalTicket: number | null;
  endingPhysicalTicket: number | null;
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
  const beginningComplete = activeDisplayPackCount > 0 && lines.filter((line) => line.beginningPhysicalTicket !== null).length === activeDisplayPackCount;

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
        {!audit && <Button onClick={beginAudit}>Begin Audit</Button>}
      </div>
      {audit && audit.status === "OPEN" && <>
        <div className="mt-3 flex items-center gap-2"><Button size="sm" variant={phase === "beginning" ? "secondary" : "ghost"} onClick={() => setPhase("beginning")}>Beginning</Button><Button size="sm" variant={phase === "ending" ? "secondary" : "ghost"} disabled={!beginningComplete} onClick={() => setPhase("ending")}>Ending</Button><span className={`text-sm font-medium ${activeDisplayPackCount > 0 && scanned === activeDisplayPackCount ? "text-emerald-700" : "text-text-secondary"}`}>{scanned}/{activeDisplayPackCount} Scanned{activeDisplayPackCount > 0 && scanned === activeDisplayPackCount ? " (Complete)" : ""}</span></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><input ref={inputRef} autoFocus value={barcode} inputMode="numeric" onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void scan(); } }} placeholder="Scan the current ticket barcode" className="min-w-0 rounded-md border-2 border-border px-3 py-3 font-mono text-lg tracking-wider" /><Button onClick={() => { void scan(); }} disabled={!barcode.trim()}>Record Scan</Button></div>
        <p className="mt-2 text-xs text-text-tertiary">Use one complete 14-digit ticket barcode. The first 11 digits identify the display pack and the last 3 digits are recorded automatically as the physical ticket number.</p>
        <Button className="mt-3" variant="outline" disabled={phase !== "ending" || scanned !== activeDisplayPackCount} onClick={completeAudit}>Complete Ending Audit</Button>
      </>}
      {audit?.status === "COMPLETED" && <p className="mt-3 text-sm font-semibold text-emerald-700">Audit completed. Manager review is required for any variance.</p>}
      {message && <p role="status" className={`mt-2 text-sm ${messageType === "success" ? "text-emerald-700" : "text-red-700"}`}>{message}</p>}
    </Panel>
  );
}
