"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2, Users, Package, TrendingUp, RefreshCw, Plus, X, Check,
  Loader2, Clock, AlertCircle, CheckCircle2, ChevronRight,
} from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { TicketReportsPanel } from "@/components/reports/ticket-reports-panel";
import { TicketReturnRequestsPanel } from "@/components/reports/ticket-return-requests-panel";
import { ShipmentOverrideNotifications } from "@/components/reports/shipment-override-notifications";
import { StateReportsUploader } from "@/components/owner/state-reports-uploader";
import { StoreComparisonPanel } from "@/components/owner/store-comparison-panel";

interface StoreKPI {
  id: string;
  name: string;
  storeNumber?: string | null;
  timezone: string;
  address: string | null;
  phone: string | null;
  createdAt: string;
  users: { id: string; role: string; active: boolean }[];
  _count: { packs: number; shifts: number };
  // populated from /api/reports/shifts
  salesToday?: number;
  openShift?: boolean;
  backstock?: number;
  activePacks?: number;
  ticketsToday?: number;
  lockedPacks?: number;
}

const TZ_LABELS: Record<string, string> = {
  "America/Chicago": "CT",
  "America/New_York": "ET",
  "America/Denver": "MT",
  "America/Los_Angeles": "PT",
  "America/Phoenix": "AZ",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

interface AddStoreFormProps {
  onCreated: (store: StoreKPI) => void;
  onCancel: () => void;
}

function AddStoreForm({ onCreated, onCancel }: AddStoreFormProps) {
  const [name, setName] = useState("");
  const [storeNumber, setStoreNumber] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, storeNumber, timezone, address, phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create store."); return; }
      onCreated(data.store);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Store Name *</label>
          <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Sunrise Mart #5" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Store Number *</label>
          <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Store 001" value={storeNumber} onChange={(e) => setStoreNumber(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Store Location Address</label>
          <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="123 Main St, Houston TX" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Store Phone Number</label>
          <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="(713) 555-0100" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Timezone</label>
          <select className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            <option value="America/Chicago">Central Time (CT)</option>
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Denver">Mountain Time (MT)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
            <option value="America/Phoenix">Arizona (no DST)</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Check size={14} className="mr-1" />}
          Create Store
        </Button>
      </div>
    </form>
  );
}

function StoreCard({ store }: { store: StoreKPI }) {
  const activeUsers = store.users.filter((u) => u.active).length;
  const tz = TZ_LABELS[store.timezone] ?? store.timezone;

  return (
    <a href={`/owner/stores/${store.id}`} className="block">
    <Panel className="p-4 hover:border-accent/50 transition-colors cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Building2 size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-text text-sm">{store.name}</h3>
            {store.storeNumber && <p className="text-xs text-text-secondary">Store {store.storeNumber}</p>}
            {store.address && <p className="text-xs text-text-tertiary">{store.address}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-text-tertiary bg-surface-soft rounded px-1.5 py-0.5">{tz}</span>
          {store.openShift !== undefined && (
            store.openShift
              ? <span className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 rounded px-1.5 py-0.5"><Clock size={9} /> OPEN</span>
              : <span className="flex items-center gap-1 text-[10px] text-text-tertiary bg-surface-soft rounded px-1.5 py-0.5">CLOSED</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-md bg-surface-soft p-2 text-center">
          <p className="text-lg font-bold text-text">{store.salesToday !== undefined ? fmt(store.salesToday) : "—"}</p>
          <p className="text-[10px] text-text-tertiary">Today</p>
        </div>
        <div className="rounded-md bg-surface-soft p-2 text-center">
          <p className="text-lg font-bold text-text">{store._count.packs}</p>
          <p className="text-[10px] text-text-tertiary">Packs</p>
        </div>
        <div className="rounded-md bg-surface-soft p-2 text-center">
          <p className="text-lg font-bold text-text">{activeUsers}</p>
          <p className="text-[10px] text-text-tertiary">Staff</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2 text-xs text-text-secondary">
          <span className="flex items-center gap-1"><Package size={11} /> {store.backstock ?? "—"} backstock</span>
          <span className="flex items-center gap-1"><Users size={11} /> {store._count.shifts} shifts</span>
        </div>
        <ChevronRight size={14} className="text-text-tertiary group-hover:text-accent transition-colors" />
      </div>
    </Panel>
    </a>
  );
}

export function OwnerDashboard({ view = "overview" }: { view?: "overview" | "stores" }) {
  const [stores, setStores] = useState<StoreKPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    salesToday: 0,
    ticketsToday: 0,
    activePacks: 0,
    backstockPacks: 0,
    lockedPacks: 0,
    openShifts: 0,
    auditCompletionRate: 0,
  });

  const loadStores = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/owner/overview", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const storeList: StoreKPI[] = data.stores ?? [];
      setStores(storeList);
      setSummary(data.summary ?? {
        salesToday: 0,
        ticketsToday: 0,
        activePacks: 0,
        backstockPacks: 0,
        lockedPacks: 0,
        openShifts: 0,
        auditCompletionRate: 0,
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadStores(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStores]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadStores({ silent: true });
    }, 4000);

    return () => window.clearInterval(interval);
  }, [loadStores]);

  function handleStoreCreated(store: StoreKPI) {
    setStores((prev) => [...prev, store]);
    setShowAdd(false);
    setMessage(`"${store.name}" created. Next step: add staff members from the Staff page.`);
    setTimeout(() => setMessage(null), 6000);
  }

  // Summary totals
  const totalStaff = stores.reduce((s, store) => s + store.users.filter((u) => u.active).length, 0);

  return (
    <div className="space-y-5">
      {view === "overview" && <StateReportsUploader />}
      {view === "overview" && <StoreComparisonPanel />}
      {/* Portfolio overview */}
      {view === "overview" && !loading && stores.length > 0 && (
        <section aria-labelledby="portfolio-overview" className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Portfolio overview</p>
              <h2 id="portfolio-overview" className="text-lg font-semibold text-text">Today across all stores</h2>
            </div>
            <span className="text-xs text-text-tertiary">Live owner view</span>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Lottery Sales Today", value: fmt(summary.salesToday), hint: `${summary.ticketsToday} tickets`, icon: TrendingUp, color: "text-green-600 bg-green-50" },
            { label: "Active Packs", value: summary.activePacks.toLocaleString(), hint: "On display", icon: Package, color: "text-blue-600 bg-blue-50" },
            { label: "Back Stock Packs", value: summary.backstockPacks.toLocaleString(), hint: "Not activated", icon: Package, color: "text-purple-600 bg-purple-50" },
            { label: "Locked Packs", value: summary.lockedPacks.toLocaleString(), hint: "Needs review", icon: AlertCircle, color: "text-red-600 bg-red-50" },
            { label: "Open Shifts", value: summary.openShifts.toLocaleString(), hint: `Across ${stores.length} stores`, icon: Clock, color: "text-orange-600 bg-orange-50" },
            { label: "Audit Completion", value: `${summary.auditCompletionRate}%`, hint: "Today", icon: CheckCircle2, color: "text-teal-600 bg-teal-50" },
          ].map((kpi) => (
            <Panel key={kpi.label} className="p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`rounded-lg p-1.5 ${kpi.color}`}>
                  <kpi.icon size={14} />
                </div>
                <p className="text-xs text-text-secondary">{kpi.label}</p>
              </div>
              <p className="text-2xl font-bold text-text">{kpi.value}</p>
              {kpi.hint && <p className="mt-1 text-xs text-text-tertiary">{kpi.hint}</p>}
            </Panel>
          ))}
          </div>
        </section>
      )}

      {/* Message */}
      {view === "stores" && message && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-start gap-2">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          {message}
        </div>
      )}

      {/* Store portfolio */}
      {view === "stores" && <section id="stores" aria-labelledby="store-portfolio">
      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Portfolio</p>
            <h2 id="store-portfolio" className="text-base font-semibold text-text">Your Stores</h2>
            <p className="text-xs text-text-secondary mt-0.5">{stores.length} location{stores.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => loadStores()} disabled={loading}>
              <RefreshCw size={13} className={`mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={() => setShowAdd(!showAdd)}>
              <Plus size={14} className="mr-1" />
              Add Store
            </Button>
          </div>
        </div>

        {showAdd && (
          <div className="mb-5 rounded-lg border border-border bg-surface-soft p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-text">New Store</h4>
              <button onClick={() => setShowAdd(false)} className="text-text-tertiary hover:text-text"><X size={16} /></button>
            </div>
            <AddStoreForm onCreated={handleStoreCreated} onCancel={() => setShowAdd(false)} />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-text-tertiary">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading stores...
          </div>
        ) : stores.length === 0 ? (
          <div className="py-12 text-center">
            <AlertCircle size={32} className="mx-auto mb-3 text-text-tertiary" />
            <p className="font-medium text-text">No stores yet</p>
            <p className="text-sm text-text-secondary mt-1">Create your first store location to get started.</p>
            <Button className="mt-4" onClick={() => setShowAdd(true)}>
              <Plus size={14} className="mr-1" />
              Add First Store
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stores.map((store) => (
              <StoreCard
                key={store.id}
                store={store}
              />
            ))}
          </div>
        )}
      </Panel>
      </section>}

      {view === "overview" && !loading && stores.length > 0 && (
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Portfolio health</p>
              <h2 className="text-base font-semibold text-text">What needs attention</h2>
              <p className="mt-1 text-sm text-text-secondary">{summary.lockedPacks > 0 ? `${summary.lockedPacks} locked pack${summary.lockedPacks === 1 ? "" : "s"} require review.` : "No locked packs are waiting for review."}</p>
            </div>
            <Button variant="outline" onClick={() => loadStores()}>Refresh data</Button>
          </div>
        </Panel>
      )}

      <TicketReturnRequestsPanel title="Ticket Return Requests Across Stores" />
      <ShipmentOverrideNotifications />
      <TicketReportsPanel title="Employee Ticket Reports Across Stores" />

    </div>
  );
}
