"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { SupportAccessPanel } from "@/components/support/support-access-panel";

interface StoreAccess { suspended: boolean; reason: string | null }
interface Store { id: string; name: string; owner: { name: string; email: string } | null; access: StoreAccess }

export function StoreAccessPanel() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);

  async function load() {
    setLoading(true); setError("");
    try { const response = await fetch("/api/platform/stores", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to load stores."); setStores(data.stores ?? []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load stores."); }
    finally { setLoading(false); }
  }

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function toggle(store: Store) {
    let reason = "";
    if (!store.access.suspended) reason = window.prompt("Reason for suspending this store:")?.trim() ?? "";
    if (!store.access.suspended && reason.length < 6) return;
    const response = await fetch("/api/platform/stores", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: store.id, suspended: !store.access.suspended, reason }) });
    if (response.ok) await load(); else setError((await response.json()).error || "Unable to update store access.");
  }

  async function requestAccess(store: Store) {
    setRequesting(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/support-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request", storeId: store.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to request store assistance.");
      setNotice("Request delivered in-app. The store owner must approve it on Support and share their generated link with you.");
      setRequestVersion((version) => version + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to request store assistance.");
    } finally { setRequesting(false); }
  }

  return <><Panel className="mb-4 p-5"><div className="flex items-start gap-2"><Building2 size={18} className="mt-0.5 text-accent" /><div><h3 className="text-base font-semibold text-text">Store Access Controls</h3><p className="mt-1 text-sm text-text-secondary">Suspend, reactivate, or request owner-approved assistance for a customer store.</p></div></div>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mt-3 text-sm text-text-secondary">{notice}</p>}{loading ? <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={15} className="animate-spin" />Loading stores...</div> : <div className="mt-4 space-y-2">{stores.map((store) => <div key={store.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"><div><p className="font-medium text-text">{store.name}</p><p className="text-xs text-text-secondary">{store.owner?.name ?? "No owner"} · {store.owner?.email ?? ""}</p>{store.access.suspended && <p className="mt-1 text-xs font-medium text-red-700">Suspended: {store.access.reason}</p>}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { void requestAccess(store); }} disabled={store.access.suspended || requesting}>Request store assistance</Button><Button size="sm" variant={store.access.suspended ? "secondary" : "outline"} onClick={() => { void toggle(store); }}>{store.access.suspended ? <Unlock size={14} /> : <Lock size={14} />}{store.access.suspended ? "Reactivate" : "Suspend"}</Button></div></div>)}</div>}</Panel><SupportAccessPanel key={requestVersion} role="PLATFORM_ADMIN" /></>;
}
