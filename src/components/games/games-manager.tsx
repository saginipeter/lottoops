"use client";

import { ReactNode, useMemo, useState } from "react";
import { Search, RefreshCw, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { formatCurrency } from "@/lib/utils";

type UserRole = "MANAGER" | "CLERK" | "VIEWER";

interface GameItem {
  id: string;
  gameNumber: string;
  name: string;
  price: number;
  ticketsPerPack: number;
  active: boolean;
  updatedAt: string;
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

export function GamesManager({ initialGames, userRole }: GamesManagerProps) {
  const canManage = userRole !== "VIEWER";
  const [games, setGames] = useState<GameItem[]>(initialGames);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<TexasReference | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);

  const visibleGames = useMemo(
    () => (showInactive ? games : games.filter((g) => g.active)),
    [games, showInactive]
  );

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setLookupResult(null);
  }

  async function refreshGames(includeInactive = showInactive) {
    try {
      setLoading(true);
      const res = await fetch(`/api/games?includeInactive=${includeInactive ? "true" : "false"}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to load games.");
        return;
      }
      setGames((data.games ?? []) as GameItem[]);
    } catch (err) {
      console.error(err);
      setMessage("Failed to load games.");
    } finally {
      setLoading(false);
    }
  }

  async function lookupTexasReference() {
    if (!form.gameNumber.trim()) {
      setMessage("Enter game number before Texas lookup.");
      return;
    }
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch(
        `/api/games/texas-reference?gameNumber=${encodeURIComponent(form.gameNumber.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Texas lookup failed.");
        return;
      }
      if (!data.found || !data.reference) {
        setLookupResult(null);
        setMessage("No Texas Lottery scratch game found for that game number.");
        return;
      }

      const reference = data.reference as TexasReference;
      setLookupResult(reference);
      setForm((prev) => ({
        ...prev,
        name: prev.name.trim() ? prev.name : reference.gameName,
        price: prev.price.trim() ? prev.price : String(reference.ticketPrice),
      }));
      setMessage("Texas Lottery reference found. Review and save.");
    } catch (err) {
      console.error(err);
      setMessage("Texas lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveGame() {
    if (!canManage) return;
    try {
      setSaving(true);
      setMessage(null);
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
      if (!res.ok) {
        setMessage(data.error || "Unable to save game.");
        return;
      }

      await refreshGames(true);
      setMessage(editingId ? "Game updated." : "Game added.");
      resetForm();
    } catch (err) {
      console.error(err);
      setMessage("Unable to save game.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(game: GameItem) {
    if (!canManage) return;
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch("/api/games", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: game.id,
          active: !game.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Unable to update status.");
        return;
      }

      await refreshGames(true);
      setMessage(game.active ? "Game deactivated." : "Game activated.");
    } catch (err) {
      console.error(err);
      setMessage("Unable to update status.");
    } finally {
      setLoading(false);
    }
  }

  async function syncTexasGames() {
    if (!canManage) return;
    try {
      setSyncing(true);
      setMessage(null);
      const res = await fetch("/api/games/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Sync failed.");
        return;
      }
      await refreshGames(true);
      const processed = Number(data.summary?.processed ?? 0);
      const unknown = Number(data.summary?.unknownCount ?? 0);
      const failures = Number((data.summary?.sourceFailures ?? []).length);
      setMessage(
        `Sync complete. Processed ${processed} game(s), unknown ${unknown}, source failures ${failures}.`
      );
    } catch (err) {
      console.error(err);
      setMessage("Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-text">Store Games</h3>
            <div className="flex gap-2">
              <Button onClick={syncTexasGames} disabled={!canManage || syncing || loading}>
                {syncing ? "Syncing..." : "Sync Texas Lottery"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const next = !showInactive;
                  setShowInactive(next);
                  refreshGames(next);
                }}
                disabled={loading}
              >
                {showInactive ? "Hide Inactive" : "Show Inactive"}
              </Button>
              <Button variant="secondary" onClick={() => refreshGames(true)} disabled={loading}>
                <RefreshCw className="mr-1" size={14} />
                Refresh
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
                    <td className="py-2 pr-4 font-medium text-text">{game.gameNumber}</td>
                    <td className="py-2 pr-4 text-text">{game.name}</td>
                    <td className="py-2 pr-4 text-right text-text">{formatCurrency(game.price)}</td>
                    <td className="py-2 pr-4 text-right text-text">{game.ticketsPerPack}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          game.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {game.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(game.id);
                            setForm({
                              gameNumber: game.gameNumber,
                              name: game.name,
                              price: String(game.price),
                              ticketsPerPack: String(game.ticketsPerPack),
                              active: game.active,
                            });
                            setLookupResult(null);
                            setMessage(null);
                          }}
                          disabled={!canManage}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={game.active ? "destructive" : "secondary"}
                          onClick={() => toggleActive(game)}
                          disabled={!canManage || loading}
                        >
                          {game.active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleGames.length === 0 && (
              <p className="py-6 text-center text-sm text-text-secondary">No games to display.</p>
            )}
          </div>
        </Panel>

        <Panel className="p-4">
          <h3 className="text-base font-semibold text-text">
            {editingId ? "Edit Game" : "Add Game"}
          </h3>
          <p className="mt-1 text-xs text-text-secondary">
            Use Texas Lottery reference lookup by game number before saving.
          </p>

          <div className="mt-4 space-y-3">
            <Field label="Game Number">
              <div className="flex gap-2">
                <input
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={form.gameNumber}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      gameNumber: e.target.value,
                    }))
                  }
                  placeholder="e.g. 2753"
                  disabled={!canManage || saving}
                />
                <Button
                  variant="outline"
                  onClick={lookupTexasReference}
                  disabled={!canManage || loading || !form.gameNumber.trim()}
                >
                  <Search size={14} />
                </Button>
              </div>
            </Field>

            <Field label="Game Name">
              <input
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Game name"
                disabled={!canManage || saving}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Ticket Price">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={form.price}
                  onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  disabled={!canManage || saving}
                />
              </Field>
              <Field label="Tickets / Pack">
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={form.ticketsPerPack}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      ticketsPerPack: e.target.value,
                    }))
                  }
                  disabled={!canManage || saving}
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
                disabled={!canManage || saving}
              />
              Active game
            </label>

            <div className="flex gap-2">
              <Button onClick={saveGame} disabled={!canManage || saving}>
                {saving ? "Saving..." : editingId ? "Update Game" : "Add Game"}
              </Button>
              <Button variant="ghost" onClick={resetForm} disabled={saving}>
                Reset
              </Button>
            </div>
          </div>

          {lookupResult && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              <div className="mb-1 flex items-center gap-1 font-semibold">
                <CheckCircle2 size={14} />
                Texas Lottery Reference Found
              </div>
              <p>Game #{lookupResult.gameNumber}</p>
              <p>Name: {lookupResult.gameName}</p>
              <p>Ticket price: {formatCurrency(lookupResult.ticketPrice)}</p>
              <p>Close date: {lookupResult.gameCloseDate ?? "Open / not listed"}</p>
              <a
                href={lookupResult.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 underline"
              >
                View source CSV
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          {message && (
            <p className="mt-4 text-xs text-text-secondary">{message}</p>
          )}
        </Panel>
      </div>
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
