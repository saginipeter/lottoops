"use client";

import { ReactNode, useMemo, useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, ExternalLink, CheckCircle2, Plus, Loader2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { formatCurrency } from "@/lib/utils";

type UserRole = "PLATFORM_ADMIN" | "OWNER" | "MANAGER" | "SHIFT_LEAD" | "EMPLOYEE" | "AUDITOR";

interface GameItem {
  id: string;
  gameNumber: string;
  name: string;
  price: number;
  ticketsPerPack: number;
  active: boolean;
  updatedAt: string;
}

interface CatalogItem {
  externalKey: string;
  name: string;
  gameType: string;
  status: string;
  gameNumber: string | null;
  ticketPrice: number | null;
  odds: string | null;
  topPrize: string | null;
  prizesClaimed: number | null;
  remainingTopPrizes: number | null;
  endDate: string | null;
  drawDays: string[];
  drawTimes: string[];
  salesCutoff: string | null;
  lastSyncedAt: string;
  addedToStore: boolean;
}

interface TexasReference {
  gameNumber: string;
  gameName: string;
  ticketPrice: number;
  gameCloseDate: string | null;
  sourceUrl: string;
}

interface GamesManagerProps {
  initialGames: GameItem[];
  userRole: UserRole;
}

interface FormState {
  gameNumber: string;
  name: string;
  price: string;
  ticketsPerPack: string;
  active: boolean;
}

const initialForm: FormState = {
  gameNumber: "",
  name: "",
  price: "",
  ticketsPerPack: "150",
  active: true,
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  closing: "bg-amber-100 text-amber-800",
  closed: "bg-gray-100 text-gray-600",
  unknown: "bg-gray-100 text-gray-500",
};

export function GamesManager({ initialGames, userRole }: GamesManagerProps) {
  const canManage = userRole !== "EMPLOYEE" && userRole !== "AUDITOR" && userRole !== "PLATFORM_ADMIN";
  const [tab, setTab] = useState<"store" | "catalog">("store");
  const [games, setGames] = useState<GameItem[]>(initialGames);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"ok" | "err">("ok");
  const [lookupResult, setLookupResult] = useState<TexasReference | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogType, setCatalogType] = useState("all");

  const visibleGames = useMemo(
    () => (showInactive ? games : games.filter((g) => g.active)),
    [games, showInactive]
  );

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.toLowerCase();
    return catalog.filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q) || (c.gameNumber ?? "").includes(q)) &&
        (catalogType === "all" || c.gameType === catalogType)
    );
  }, [catalog, catalogSearch, catalogType]);

  function notify(msg: string, type: "ok" | "err" = "ok") {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(null), 4000);
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setLookupResult(null);
  }

  const refreshGames = useCallback(async (includeInactive = showInactive) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/games?includeInactive=${includeInactive ? "true" : "false"}`);
      const data = await res.json();
      if (!res.ok) { notify(data.error || "Failed to load games.", "err"); return; }
      setGames((data.games ?? []) as GameItem[]);
    } catch { notify("Failed to load games.", "err"); }
    finally { setLoading(false); }
  }, [showInactive]);

  const refreshCatalog = useCallback(async () => {
    try {
      setCatalogLoading(true);
      const res = await fetch("/api/games/catalog");
      const data = await res.json();
      if (res.ok) {
        setCatalog(data.catalog ?? []);
        setCatalogTotal(data.total ?? 0);
        setLastSyncedAt(data.lastSyncedAt ?? null);
      }
    } catch { /* catalog table may not exist yet */ }
    finally { setCatalogLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "catalog" && catalog.length === 0) refreshCatalog();
  }, [tab, catalog.length, refreshCatalog]);

  async function lookupTexasReference() {
    if (!form.gameNumber.trim()) { notify("Enter game number before Texas lookup.", "err"); return; }
    try {
      setLoading(true);
      const res = await fetch(`/api/games/texas-reference?gameNumber=${encodeURIComponent(form.gameNumber.trim())}`);
      const data = await res.json();
      if (!res.ok) { notify(data.error || "Texas lookup failed.", "err"); return; }
      if (!data.found || !data.reference) { setLookupResult(null); notify("No Lottery Scratch_off Management System game found for that game number.", "err"); return; }
      const reference = data.reference as TexasReference;
      setLookupResult(reference);
      setForm((prev) => ({
        ...prev,
        name: prev.name.trim() ? prev.name : reference.gameName,
        price: prev.price.trim() ? prev.price : String(reference.ticketPrice),
      }));
      notify("Lottery Scratch_off Management System reference found. Review and save.");
    } catch { notify("Texas lookup failed.", "err"); }
    finally { setLoading(false); }
  }

  async function saveGame() {
    if (!canManage) return;
    try {
      setSaving(true);
      const payload = {
        gameNumber: form.gameNumber.trim(),
        name: form.name.trim(),
        price: Number(form.price),
        ticketsPerPack: Number(form.ticketsPerPack),
        active: form.active,
      };
      const res = await fetch("/api/games", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || "Unable to save game.", "err"); return; }
      await refreshGames(true);
      notify(editingId ? "Game updated." : "Game added.");
      resetForm();
    } catch { notify("Unable to save game.", "err"); }
    finally { setSaving(false); }
  }

  async function toggleActive(game: GameItem) {
    if (!canManage) return;
    try {
      setLoading(true);
      const res = await fetch("/api/games", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: game.id, active: !game.active }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || "Unable to update status.", "err"); return; }
      await refreshGames(true);
      notify(game.active ? "Game deactivated." : "Game activated.");
    } catch { notify("Unable to update status.", "err"); }
    finally { setLoading(false); }
  }

  async function syncTexasGames() {
    if (!canManage) return;
    try {
      setSyncing(true);
      notify("Syncing Lottery Scratch_off Management System games — this may take 30–60 seconds…");
      const res = await fetch("/api/games/sync", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (!res.ok) { notify(data.error || "Sync failed.", "err"); return; }
      const processed = Number(data.summary?.processed ?? 0);
      const failures = Number((data.summary?.sourceFailures ?? []).length);
      notify(`Sync complete — ${processed} games synced${failures > 0 ? `, ${failures} source failure(s)` : ""}.`);
      await refreshCatalog();
      setTab("catalog");
    } catch { notify("Sync failed.", "err"); }
    finally { setSyncing(false); }
  }

  async function addFromCatalog(item: CatalogItem) {
    if (!canManage || item.addedToStore) return;
    try {
      setAddingKey(item.externalKey);
      const res = await fetch("/api/games/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalKey: item.externalKey, ticketsPerPack: 150 }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || "Failed to add game.", "err"); return; }
      notify(`"${item.name}" added to your store catalog.`);
      // Mark as added in local state without full refresh
      setCatalog((prev) => prev.map((c) => c.externalKey === item.externalKey ? { ...c, addedToStore: true } : c));
      await refreshGames(true);
    } catch { notify("Failed to add game.", "err"); }
    finally { setAddingKey(null); }
  }

  return (
    <div className="space-y-4">
      {/* Tab Bar */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-border bg-surface p-0.5 gap-0.5">
          <button
            onClick={() => setTab("store")}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${tab === "store" ? "bg-accent text-white" : "text-text-secondary hover:text-text"}`}
          >
            Store Games ({games.filter(g => g.active).length} active)
          </button>
          <button
            onClick={() => { setTab("catalog"); if (catalog.length === 0) refreshCatalog(); }}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${tab === "catalog" ? "bg-accent text-white" : "text-text-secondary hover:text-text"}`}
          >
              Lottery Scratch_off Catalog {catalogTotal > 0 ? `(${catalogTotal})` : ""}
          </button>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button onClick={syncTexasGames} disabled={syncing} variant="outline">
              {syncing ? <><Loader2 size={13} className="animate-spin mr-1.5" />Syncing…</> : <><RefreshCw size={13} className="mr-1.5" />Sync Lottery Scratch_off</>}
            </Button>
          )}
        </div>
      </div>

      {/* Global message */}
      {message && (
        <div className={`rounded-md border px-3 py-2 text-sm ${messageType === "err" ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* ── STORE GAMES TAB ── */}
      {tab === "store" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Panel className="xl:col-span-2 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-text">Store Game Catalog</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { const next = !showInactive; setShowInactive(next); refreshGames(next); }}
                  disabled={loading}
                >
                  {showInactive ? "Hide Inactive" : "Show Inactive"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => refreshGames()} disabled={loading}>
                  <RefreshCw size={13} />
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
                    <th className="py-2 pr-4">Game #</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4 text-right">Price</th>
                    <th className="py-2 pr-4 text-right">Pack Size</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleGames.map((game) => (
                    <tr key={game.id} className="border-b border-border">
                      <td className="py-2 pr-4 font-mono text-xs text-text">{game.gameNumber}</td>
                      <td className="py-2 pr-4 text-text">{game.name}</td>
                      <td className="py-2 pr-4 text-right text-text">{formatCurrency(game.price)}</td>
                      <td className="py-2 pr-4 text-right text-text">{game.ticketsPerPack}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${game.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                          {game.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" disabled={!canManage}
                            onClick={() => { setEditingId(game.id); setForm({ gameNumber: game.gameNumber, name: game.name, price: String(game.price), ticketsPerPack: String(game.ticketsPerPack), active: game.active }); setLookupResult(null); }}>
                            Edit
                          </Button>
                          <Button size="sm" variant={game.active ? "destructive" : "secondary"} onClick={() => toggleActive(game)} disabled={!canManage || loading}>
                            {game.active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleGames.length === 0 && (
                <div className="py-10 text-center">
                  <Database size={28} className="mx-auto mb-2 text-text-tertiary" />
                  <p className="text-sm text-text-secondary">No store games yet.</p>
                  <p className="text-xs text-text-tertiary mt-1">Add manually below, or sync Lottery Scratch_off Management System games from the catalog tab.</p>
                </div>
              )}
            </div>
          </Panel>

          <Panel className="p-4">
            <h3 className="text-base font-semibold text-text">{editingId ? "Edit Game" : "Add Game Manually"}</h3>
            <p className="mt-1 text-xs text-text-secondary">Look up by game # to auto-fill from the Lottery Scratch_off Management System catalog.</p>
            <div className="mt-4 space-y-3">
              <Field label="Game Number">
                <div className="flex gap-2">
                  <input className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={form.gameNumber}
                    onChange={(e) => setForm((p) => ({ ...p, gameNumber: e.target.value }))} placeholder="e.g. 2753" disabled={!canManage || saving} />
                  <Button variant="outline" onClick={lookupTexasReference} disabled={!canManage || loading || !form.gameNumber.trim()}><Search size={14} /></Button>
                </div>
              </Field>
              <Field label="Game Name">
                <input className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Game name" disabled={!canManage || saving} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Ticket Price">
                  <input type="number" min={0} step="0.01" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} placeholder="0.00" disabled={!canManage || saving} />
                </Field>
                <Field label="Tickets / Pack">
                  <input type="number" min={1} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    value={form.ticketsPerPack} onChange={(e) => setForm((p) => ({ ...p, ticketsPerPack: e.target.value }))} disabled={!canManage || saving} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-text">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} disabled={!canManage || saving} />
                Active game
              </label>
              <div className="flex gap-2">
                <Button onClick={saveGame} disabled={!canManage || saving}>
                  {saving ? <><Loader2 size={13} className="animate-spin mr-1" />Saving…</> : (editingId ? "Update Game" : "Add Game")}
                </Button>
                <Button variant="ghost" onClick={resetForm} disabled={saving}>Reset</Button>
              </div>
            </div>
            {lookupResult && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                <div className="mb-1 flex items-center gap-1 font-semibold"><CheckCircle2 size={14} />Lottery Scratch_off Management System Reference Found</div>
                <p>Game #{lookupResult.gameNumber}</p>
                <p>{lookupResult.gameName} — {formatCurrency(lookupResult.ticketPrice)}</p>
                <p>Close date: {lookupResult.gameCloseDate ?? "Open / not listed"}</p>
                <a href={lookupResult.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 underline">
                  View source <ExternalLink size={11} />
                </a>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ── TEXAS CATALOG TAB ── */}
      {tab === "catalog" && (
        <Panel className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-text">Lottery Scratch_off Management System Game Catalog</h3>
              {lastSyncedAt && (
                <p className="text-xs text-text-tertiary mt-0.5">
                  Last synced {new Date(lastSyncedAt).toLocaleString()}
                </p>
              )}
              {!lastSyncedAt && !catalogLoading && (
                <p className="text-xs text-amber-600 mt-0.5">Not yet synced — click &quot;Sync Lottery Scratch_off&quot; above to populate.</p>
              )}
            </div>
            <div className="flex gap-2">
              <select
                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text"
                value={catalogType}
                onChange={(e) => setCatalogType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="scratch_off">Scratch-Offs</option>
                <option value="draw_game">Draw Games</option>
              </select>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  className="rounded-md border border-border bg-surface pl-7 pr-3 py-1.5 text-xs text-text w-44"
                  placeholder="Search games…"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={refreshCatalog} disabled={catalogLoading}>
                <RefreshCw size={13} className={catalogLoading ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>

          {catalogLoading ? (
            <div className="flex items-center justify-center py-12 text-text-tertiary">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading catalog…
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="py-12 text-center">
              <RefreshCw size={28} className="mx-auto mb-2 text-text-tertiary" />
              <p className="text-sm text-text-secondary">No catalog data found.</p>
              <p className="text-xs text-text-tertiary mt-1">Click &quot;Sync Lottery Scratch_off&quot; above to fetch the latest games.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
                    <th className="py-2 pr-3">Game #</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3 text-right">Price</th>
                    <th className="py-2 pr-3">Top Prize</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map((item) => (
                    <tr key={item.externalKey} className="border-b border-border hover:bg-surface-soft">
                      <td className="py-2 pr-3 font-mono text-xs text-text">{item.gameNumber ?? "—"}</td>
                      <td className="py-2 pr-3 text-text font-medium">{item.name}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.gameType === "scratch_off" ? "bg-purple-100 text-purple-700" : item.gameType === "draw_game" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                          {item.gameType === "scratch_off" ? "Scratch-Off" : item.gameType === "draw_game" ? "Draw" : "Unknown"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right text-text">
                        {item.ticketPrice ? formatCurrency(item.ticketPrice) : item.drawDays?.length ? item.drawDays.join(", ") : "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs text-text-secondary">
                        {item.topPrize ?? (item.salesCutoff ? `Cutoff: ${item.salesCutoff}` : "—")}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {item.addedToStore ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <CheckCircle2 size={12} /> Added
                          </span>
                        ) : item.gameType === "draw_game" ? (
                          <span className="text-[11px] text-text-tertiary">Draw game</span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={!canManage || addingKey === item.externalKey}
                            onClick={() => addFromCatalog(item)}
                          >
                            {addingKey === item.externalKey ? <Loader2 size={12} className="animate-spin" /> : <><Plus size={12} className="mr-1" />Add</>}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-right text-[11px] text-text-tertiary">{filteredCatalog.length} of {catalogTotal} games</p>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-tertiary">{label}</p>
      {children}
    </div>
  );
}
