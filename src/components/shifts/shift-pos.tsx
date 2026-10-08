"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ChevronLeft, Clock3, LogIn, LogOut, Radio, Users } from "lucide-react";
import PhysicalAuditPanel from "@/components/inventory/physical-audit-panel";
import { formatCurrency } from "@/lib/utils";

type ShiftEvent = { id: string; action: string; detail: string; timestamp: string; performedBy: string };
type Participant = { userId: string; name: string; email: string; firstSeenAt: string; lastSeenAt: string };
type ShiftPosProps = {
  shift: any | null;
  recentClosedShift?: any | null;
  terminalId: string;
  activeDisplayPackCount: number;
  shiftEvents: ShiftEvent[];
  participants: Participant[];
  employeeName: string;
  storeName: string;
};

export function ShiftPos({ shift, recentClosedShift, terminalId, activeDisplayPackCount, shiftEvents, participants, employeeName, storeName }: ShiftPosProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const ticketsSold = shift?.lines?.reduce((sum: number, line: any) => sum + soldFromLine(line), 0) ?? 0;
  const sales = shift?.lines?.reduce((sum: number, line: any) => sum + soldFromLine(line) * Number(line.pack?.ticketPrice ?? line.pack?.game?.price ?? 0), 0) ?? 0;
  const openingComplete = Boolean(shift?.inventoryAudit?.lines?.every((line: any) => line.beginningPhysicalTicket !== null)) || activeDisplayPackCount === 0;
  const closingComplete = shift?.inventoryAudit?.status === "COMPLETED";

  async function clockIn() {
    setLoading(true); setMessage("");
    const response = await fetch("/api/shifts/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ terminalId }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(data.error ?? "Unable to clock in."); else window.location.reload();
    setLoading(false);
  }

  async function clockOut() {
    if (!shift || !window.confirm("Clock out and close this shift? The Closing Audit must be complete.")) return;
    setLoading(true); setMessage("");
    const response = await fetch("/api/shifts/close", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shiftId: shift.id }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(data.error ?? "Unable to clock out."); else window.location.reload();
    setLoading(false);
  }

  return <div className="min-h-full bg-[#f4f7fb] text-[#17233f]">
    <header className="border-b border-slate-200 bg-white px-5 py-3 sm:px-8"><div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#087da8]">{storeName} · Shift management · {terminalId}</p><h1 className="mt-1 text-2xl font-black tracking-tight">SHIFT</h1></div><div className="text-right text-xs"><p className="text-slate-500">Signed in as</p><p className="font-bold">{employeeName}</p><p className={`mt-1 font-black ${shift ? "text-emerald-700" : "text-slate-500"}`}>{shift ? "CLOCKED IN" : "CLOCKED OUT"}</p></div></div></header>
    <main className="mx-auto max-w-[1180px] px-5 py-5 sm:px-8 sm:py-7">
      {!shift ? <ClockedOut employeeName={employeeName} terminalId={terminalId} recentClosedShift={recentClosedShift} loading={loading} message={message} onClockIn={clockIn} /> : <>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div className="flex items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Clock3 size={28} /></span><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Shift in progress</p><h2 className="mt-1 text-2xl font-black">Clocked in on {terminalId}</h2><p className="mt-1 text-sm text-slate-500">Opened by {shift.openedBy?.name ?? employeeName} · {formatDate(shift.openedAt)}</p></div></div><div className="flex flex-wrap gap-2"><Link href={`/inventory/live-scan?terminal=${terminalId}`} className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-[#1688ff] px-4 text-sm font-black text-[#1688ff]"><Radio size={17} /> Live Scan</Link><button type="button" onClick={() => void clockOut()} disabled={loading} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#17233f] px-4 text-sm font-black text-white disabled:bg-slate-300"><LogOut size={17} /> {loading ? "Clocking out…" : "Clock out"}</button></div></div>{message && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}</section>
        <section className="mt-4"><div className="mb-3 flex items-end justify-between"><div><p className="text-sm font-semibold text-slate-500">Handover summary</p><h2 className="text-xl font-black">Current shift at a glance</h2></div><span className="text-xs font-bold text-slate-500">{shiftEvents.length} activity events</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Active displays" value={String(activeDisplayPackCount)} /><Stat label="Tickets sold" value={String(ticketsSold)} /><Stat label="Sales" value={formatCurrency(sales)} /><Stat label="Team members" value={String(Math.max(participants.length, 1))} /></div></section>
        <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black">Handover details</h3><p className="mt-1 text-xs text-slate-500">Use this summary when another employee takes over.</p></div><Users className="text-[#1688ff]" size={21} /></div><div className="mt-4 grid grid-cols-2 gap-3"><Detail label="Terminal" value={terminalId} /><Detail label="Opened" value={formatDate(shift.openedAt)} /><Detail label="Opened by" value={shift.openedBy?.name ?? "Unknown"} /><Detail label="Tracked packs" value={String(shift.lines?.length ?? 0)} /></div><div className="mt-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Team on shift</p><div className="mt-2 flex flex-wrap gap-2">{participants.length === 0 ? <span className="text-sm text-slate-500">Only the opening employee is recorded.</span> : participants.map((person) => <span key={person.userId} className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">{person.name}</span>)}</div></div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-black">Shift checklist</h3><p className="mt-1 text-xs text-slate-500">Complete each stage separately.</p></div><CheckCircle2 className={closingComplete ? "text-emerald-600" : "text-slate-300"} size={22} /></div><div className="mt-4 space-y-2"><Checklist label="Opening Audit" complete={openingComplete} /><Checklist label="Closing Audit" complete={closingComplete} /></div><p className="mt-4 text-xs text-slate-500">Clock out is enabled by the existing Closing Audit rules.</p></div></section>
        <section className="mt-4" id="physical-audit"><PhysicalAuditPanel shiftId={shift.id} audit={shift.inventoryAudit} activeDisplayPackCount={activeDisplayPackCount} /></section>
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black">Latest activity</h3>{shiftEvents.length === 0 ? <p className="mt-3 text-sm text-slate-500">No activity recorded yet.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{shiftEvents.slice(0, 6).map((event) => <div key={event.id} className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">{event.action.replaceAll("_", " ")}</p><p className="mt-1 text-sm">{event.detail}</p></div>)}</div>}</section>
      </>}
    </main><div className="mx-auto flex max-w-[1180px] justify-between px-5 pb-5 text-xs font-semibold text-slate-500 sm:px-8"><Link href="/" className="inline-flex items-center gap-1 hover:text-[#1688ff]"><ChevronLeft size={15} /> Back to home</Link><span>Shift management · {terminalId}</span></div>
  </div>;
}

function ClockedOut({ employeeName, terminalId, recentClosedShift, loading, message, onClockIn }: { employeeName: string; terminalId: string; recentClosedShift?: any; loading: boolean; message: string; onClockIn: () => void }) { return <><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10"><div className="mx-auto max-w-xl text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1688ff]/10 text-[#1688ff]"><LogIn size={30} /></span><p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-[#087da8]">Clock-in required</p><h2 className="mt-2 text-2xl font-black">Ready to start, {employeeName}?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Clock in on {terminalId} to create today’s shift snapshot. Complete the Opening Audit before sales begin.</p><button type="button" onClick={onClockIn} disabled={loading} className="mt-6 min-h-14 w-full rounded-xl bg-[#1688ff] text-lg font-black text-white disabled:bg-slate-300">{loading ? "Clocking in…" : `Clock in · ${terminalId}`}</button>{message && <p className="mt-4 rounded-lg bg-red-50 p-3 text-left text-sm font-bold text-red-700">{message}</p>}</div></section>{recentClosedShift && <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Last handover</p><p className="mt-2 text-sm font-bold">Opened by {recentClosedShift.openedBy?.name ?? "Unknown"} · closed by {recentClosedShift.closedBy?.name ?? "Unknown"}</p><p className="mt-1 text-xs text-slate-500">{formatDate(recentClosedShift.closedAt)}</p></section>}</>; }
function soldFromLine(line: any) { const beginning = Number(line.beginningTicket ?? 0); const current = line.pack?.currentTicketNumber == null ? beginning : Number(line.pack.currentTicketNumber); return Math.max(beginning - Math.min(Math.max(current, 0), beginning), 0); }
function formatDate(value: string | Date | null | undefined) { return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words font-bold">{value}</p></div>; }
function Checklist({ label, complete }: { label: string; complete: boolean }) { return <div className={`flex items-center justify-between rounded-lg p-3 ${complete ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}><span className="font-bold">{label}</span><span className="inline-flex items-center gap-1 text-xs font-black">{complete && <CheckCircle2 size={16} />}{complete ? "Complete" : "Required"}</span></div>; }
