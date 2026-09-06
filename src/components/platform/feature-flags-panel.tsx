"use client";

import { useEffect, useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { Panel } from "@/components/ui/panel";

const FEATURES = [
  { key: "OCR_RECEIPTS", label: "OCR receipt parsing" },
  { key: "WHATSAPP_SUMMARIES", label: "WhatsApp summary alerts" },
  { key: "AI_DISCREPANCY_ANALYSIS", label: "AI discrepancy analysis" },
] as const;
interface Store { id: string; name: string }
interface Flag { storeId: string; featureKey: string; enabled: boolean }

export function FeatureFlagsPanel() {
  const [stores, setStores] = useState<Store[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try { const response = await fetch("/api/platform/features", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to load feature flags."); setStores(data.stores ?? []); setFlags(data.flags ?? []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load feature flags."); }
    finally { setLoading(false); }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  async function toggle(storeId: string, featureKey: string, enabled: boolean) {
    const response = await fetch("/api/platform/features", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, featureKey, enabled }) });
    if (response.ok) setFlags((current) => [...current.filter((flag) => !(flag.storeId === storeId && flag.featureKey === featureKey)), { storeId, featureKey, enabled }]);
    else setError((await response.json()).error || "Unable to update feature flag.");
  }
  return <Panel className="p-5"><div className="flex items-start gap-2"><SlidersHorizontal size={18} className="mt-0.5 text-accent" /><div><h3 className="text-base font-semibold text-text">Store Feature Flags</h3><p className="mt-1 text-sm text-text-secondary">Enable or disable premium add-ons by customer store.</p></div></div>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}{loading ? <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={15} className="animate-spin" />Loading feature flags...</div> : stores.length === 0 ? <p className="mt-4 text-sm text-text-secondary">No customer stores available.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary"><th className="py-2 pr-3">Store</th>{FEATURES.map((feature) => <th key={feature.key} className="py-2 pr-3">{feature.label}</th>)}</tr></thead><tbody>{stores.map((store) => <tr key={store.id} className="border-b border-border last:border-0"><td className="py-3 pr-3 font-medium text-text">{store.name}</td>{FEATURES.map((feature) => { const enabled = flags.some((flag) => flag.storeId === store.id && flag.featureKey === feature.key && flag.enabled); return <td key={feature.key} className="py-3 pr-3"><label className="inline-flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={enabled} onChange={(event) => { void toggle(store.id, feature.key, event.target.checked); }} />{enabled ? "Enabled" : "Disabled"}</label></td>; })}</tr>)}</tbody></table></div>}</Panel>;
}
