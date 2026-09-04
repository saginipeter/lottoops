"use client";

import { useEffect, useState } from "react";
import { Activity, Building2, CheckCircle2, Clock3, Loader2, Plus, Users } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

interface Metrics {
  stores: number;
  users: number;
  owners: number;
  managers: number;
  packs: number;
  openShifts: number;
  subscriptions: number;
}

interface RecentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
  store: { name: string };
}

interface StoreHealth {
  id: string;
  name: string;
  reportCount: number;
  discrepancyCount: number;
  openShift: { openedAt: string; employee: { name: string; email: string } } | null;
}

export function PlatformControlCenter() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [health, setHealth] = useState<StoreHealth[]>([]);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [storeName, setStoreName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      const response = await fetch("/api/platform/overview", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load platform data.");
      setMetrics(data.metrics);
      setRecentUsers(data.recentUsers ?? []);
      setHealth(data.health ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load platform data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const response = await fetch("/api/platform/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerName, email, storeName, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create account.");
      setMessage(`Customer account created for ${data.account.owner.name}.`);
      setOwnerName(""); setEmail(""); setStoreName(""); setPassword("");
      setShowAccountForm(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">LottoOps platform administration</p>
          <h2 className="mt-1 text-xl font-semibold text-text">Control Center</h2>
          <p className="mt-1 text-sm text-text-secondary">Manage customer accounts and monitor the health of every LottoOps deployment.</p>
        </div>
        <Button onClick={() => setShowAccountForm((value) => !value)}><Plus size={15} /> Create Customer Account</Button>
      </div>

      {message && <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><CheckCircle2 size={15} /> {message}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showAccountForm && (
        <Panel className="border-accent/30 p-5">
          <h3 className="text-base font-semibold text-text">New Customer Account</h3>
          <p className="mt-1 text-sm text-text-secondary">Creates the customer Owner login and their first store.</p>
          <form onSubmit={createAccount} className="mt-4 grid gap-3 md:grid-cols-2">
            <input required value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Customer owner name" className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Owner email" className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
            <input required value={storeName} onChange={(event) => setStoreName(event.target.value)} placeholder="First store name" className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
            <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Temporary password" className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" onClick={() => setShowAccountForm(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Creating..." : "Create Account"}</Button></div>
          </form>
        </Panel>
      )}

      {loading || !metrics ? <div className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Loading platform metrics...</div> : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          {[
            { label: "Customer Stores", value: metrics.stores, Icon: Building2 },
            { label: "Customer Users", value: metrics.users, Icon: Users },
            { label: "Store Owners", value: metrics.owners, Icon: Users },
            { label: "Managers", value: metrics.managers, Icon: Users },
            { label: "Tracked Packs", value: metrics.packs, Icon: Activity },
            { label: "Open Shifts", value: metrics.openShifts, Icon: Activity },
            { label: "Subscriptions", value: metrics.subscriptions, Icon: CheckCircle2 },
          ].map(({ label, value, Icon }) => <Panel key={label} className="p-4"><Icon size={16} className="text-accent" /><p className="mt-3 text-xs text-text-secondary">{label}</p><p className="mt-1 text-2xl font-bold text-text">{value}</p></Panel>)}
        </div>
      )}

      <Panel className="p-5">
        <div className="mb-3 flex items-center gap-2"><Activity size={17} className="text-accent" /><h3 className="text-base font-semibold text-text">Recently created accounts</h3></div>
        {recentUsers.length === 0 ? <p className="text-sm text-text-secondary">No customer accounts yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary"><th className="py-2 pr-3">Owner</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Store</th><th className="py-2 pr-3">Role</th><th className="py-2">Created</th></tr></thead><tbody>{recentUsers.map((user) => <tr key={user.id} className="border-b border-border last:border-0"><td className="py-2.5 pr-3 font-medium text-text">{user.name}</td><td className="py-2.5 pr-3 text-text-secondary">{user.email}</td><td className="py-2.5 pr-3 text-text-secondary">{user.store.name}</td><td className="py-2.5 pr-3 text-text-secondary">{user.role}</td><td className="py-2.5 text-text-secondary">{new Date(user.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
      </Panel>

      <Panel className="p-5">
        <div className="mb-3 flex items-center gap-2"><Activity size={17} className="text-accent" /><h3 className="text-base font-semibold text-text">Store health and compliance</h3></div>
        {health.length === 0 ? <p className="text-sm text-text-secondary">No customer store health data is available.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary"><th className="py-2 pr-3">Store</th><th className="py-2 pr-3">Monday reports</th><th className="py-2 pr-3">Open shift</th><th className="py-2">Discrepancies</th></tr></thead><tbody>{health.map((store) => <tr key={store.id} className="border-b border-border last:border-0"><td className="py-2.5 pr-3 font-medium text-text">{store.name}</td><td className="py-2.5 pr-3"><span className={store.reportCount === 3 ? "text-emerald-700" : "text-amber-700"}>{store.reportCount} / 3</span></td><td className="py-2.5 pr-3 text-text-secondary">{store.openShift ? <span className="inline-flex items-center gap-1"><Clock3 size={13} /> {store.openShift.employee.name} · {new Date(store.openShift.openedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span> : "Closed"}</td><td className={store.discrepancyCount > 0 ? "py-2.5 font-semibold text-red-700" : "py-2.5 text-emerald-700"}>{store.discrepancyCount}</td></tr>)}</tbody></table></div>}
      </Panel>
    </div>
  );
}
