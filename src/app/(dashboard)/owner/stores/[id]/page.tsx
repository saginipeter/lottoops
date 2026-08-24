import Link from "next/link";
import { ArrowLeft, AlertTriangle, Boxes, Clock, Users } from "lucide-react";
import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { Panel } from "@/components/ui/panel";
import { StatusBar } from "@/components/ui/status-bar";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";

export default async function OwnerStorePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "OWNER") redirect("/");

  const { id } = await params;
  const store = await prisma.store.findFirst({
    where: { id, ownerUserId: session.userId },
    include: { users: { where: { active: true }, select: { id: true } } },
  });
  if (!store) notFound();

  const [packs, shifts, todayLines] = await Promise.all([
    prisma.pack.findMany({ where: { storeId: store.id }, select: { status: true, sequenceLocked: true } }),
    prisma.shift.findMany({ where: { storeId: store.id }, orderBy: { openedAt: "desc" }, take: 10, select: { id: true, status: true, openedAt: true, closedAt: true, openedBy: { select: { name: true } }, closedBy: { select: { name: true } } } }),
    prisma.shiftLine.findMany({ where: { shift: { storeId: store.id, openedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }, }, select: { ticketsSold: true, salesAmount: true } }),
  ]);

  const salesToday = todayLines.reduce((sum: number, line: any) => sum + Number(line.salesAmount ?? 0), 0);
  const ticketsToday = todayLines.reduce((sum: number, line: any) => sum + Number(line.ticketsSold ?? 0), 0);
  const activePacks = packs.filter((pack: any) => pack.status === "ACTIVE").length;
  const backstockPacks = packs.filter((pack: any) => pack.status === "BACK_STOCK").length;
  const lockedPacks = packs.filter((pack: any) => pack.sequenceLocked).length;
  const openShifts = shifts.filter((shift: any) => shift.status === "OPEN").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header title={store.name} subtitle="Owner store oversight and performance" />
      <PageToolbar left={<span className="text-xs text-text-secondary">Owner view · {store.timezone}</span>} center={<span>Today · store detail</span>} right={<Link href="/owner"><Button size="xs" variant="ghost"><ArrowLeft size={14} /> All Stores</Button></Link>} />
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Metric label="Sales Today" value={`$${salesToday.toFixed(2)}`} />
            <Metric label="Tickets" value={ticketsToday.toLocaleString()} />
            <Metric label="Active Packs" value={activePacks.toLocaleString()} />
            <Metric label="Back Stock" value={backstockPacks.toLocaleString()} />
            <Metric label="Locked Packs" value={lockedPacks.toLocaleString()} />
            <Metric label="Open Shifts" value={openShifts.toLocaleString()} />
            <Metric label="Active Staff" value={store.users.length.toLocaleString()} />
          </div>

          {lockedPacks > 0 && <div className="flex items-center gap-2 rounded-md border-2 border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"><AlertTriangle size={18} /> {lockedPacks} pack{lockedPacks === 1 ? "" : "s"} require discrepancy review.</div>}

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Panel className="p-5">
              <div className="flex items-center gap-2"><Clock size={17} className="text-accent" /><h2 className="font-semibold">Recent shifts</h2></div>
              <div className="mt-4 divide-y divide-border">
                {shifts.map((shift) => <div key={shift.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{shift.openedBy.name}</p><p className="text-xs text-text-tertiary">Opened {new Date(shift.openedAt).toLocaleString()}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${shift.status === "OPEN" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{shift.status}</span></div>)}
                {shifts.length === 0 && <p className="py-4 text-sm text-text-secondary">No shifts recorded for this store.</p>}
              </div>
            </Panel>
            <Panel className="p-5">
              <div className="flex items-center gap-2"><Boxes size={17} className="text-accent" /><h2 className="font-semibold">Inventory posture</h2></div>
              <div className="mt-4 space-y-3 text-sm"><Row label="Active on display" value={activePacks} /><Row label="Available back stock" value={backstockPacks} /><Row label="Locked for review" value={lockedPacks} /><Row label="Active staff" value={store.users.length} /></div>
              <Link href="/reports" className="mt-5 inline-flex text-sm font-semibold text-accent">Open performance reports</Link>
            </Panel>
          </div>
        </div>
      </div>
      <StatusBar left={<span>{store.name}</span>} center={<span>Sales today: ${salesToday.toFixed(2)}</span>} right={<span>Owner oversight</span>} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <Panel className="p-3"><p className="text-xs text-text-tertiary">{label}</p><p className="mt-1 text-xl font-bold text-text">{value}</p></Panel>; }
function Row({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between border-b border-border pb-2"><span className="text-text-secondary">{label}</span><span className="font-bold text-text">{value}</span></div>; }