"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { RemoveActivePackModal } from "./remove-active-pack-modal";
import { getDisplayedTicketNumber } from "@/lib/tv-display";

interface Props {
  packs: any[];
  canManageDisplay: boolean;
  slots: Array<{ id: string; slotNumber: string; occupied: boolean }>;
}

export function ActiveStockTable({ packs, canManageDisplay, slots }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedPack, setSelectedPack] = useState<any>(null);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [updatingDirectionId, setUpdatingDirectionId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredPacks = useMemo(() => {
    const term = search.toLowerCase();
    const filtered = !search ? packs : packs.filter((pack) => {
      const slot = String(pack.slot?.slotNumber ?? "").toLowerCase();
      const gameName = String(pack.game?.name ?? "").toLowerCase();
      const packNumber = String(pack.packNumber ?? "").toLowerCase();
      const serial = String(pack.serialNumber ?? "").toLowerCase();

      return (
        slot.includes(term) ||
        gameName.includes(term) ||
        packNumber.includes(term) ||
        serial.includes(term)
      );
    });

    return [...filtered].sort((a, b) => {
      const slotA = Number.parseInt(String(a.slot?.slotNumber ?? ""), 10);
      const slotB = Number.parseInt(String(b.slot?.slotNumber ?? ""), 10);
      if (Number.isNaN(slotA)) return 1;
      if (Number.isNaN(slotB)) return -1;
      return slotA - slotB;
    });
  }, [packs, search]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setSearch("");
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function openRemoveModal(pack: any) {
    setSelectedPack(pack);
    setRemoveModalOpen(true);
  }

  function handleSuccess() {
    // Reload the page to reflect changes
    location.reload();
  }

  async function updateDirection(pack: any, next: "FIRST" | "LAST") {
    const current = pack.firstOrLastTicket === "LAST" ? "LAST" : "FIRST";
    if (next === current) return;
    const reason = window.prompt("Enter the reason for changing the sell direction:")?.trim();
    if (!reason || reason.length < 6) return;
    try {
      setUpdatingDirectionId(pack.id);
      const response = await fetch("/api/packs/update-direction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id, direction: next, reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(data.error ?? "Unable to update sell direction.");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Unable to update sell direction. Check your connection and try again.");
    } finally {
      setUpdatingDirectionId(null);
    }
  }

  function displayedCurrentTicket(pack: any) {
    const quantity = Number(pack.ticketQuantity ?? pack.game?.ticketsPerPack ?? 0);
    const remaining = Number(pack.currentTicketNumber ?? quantity);
    const direction = pack.firstOrLastTicket === "LAST" ? "LAST" : "FIRST";
    return getDisplayedTicketNumber(
      Number(pack.firstTicket ?? 1),
      remaining,
      quantity,
      direction,
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Modal */}
      <RemoveActivePackModal
        pack={selectedPack}
        isOpen={removeModalOpen}
        onClose={() => setRemoveModalOpen(false)}
        onSuccess={handleSuccess}
        slots={slots}
      />

      <PageToolbar
        left={
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-text-tertiary" size={16} />
            <input
              ref={searchInputRef}
              className="h-8 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              placeholder="Search display, game, serial, or pack"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
        center={<span>Ctrl+F Search | Esc Clear</span>}
        right={<span className="text-xs text-text-tertiary">{filteredPacks.length} visible</span>}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/60">
            <tr className="text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="px-3 py-2">Display</th>
              <th className="px-3 py-2">Game</th>
              <th className="px-3 py-2">Pack</th>
              <th className="px-3 py-2">Current Ticket</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Activated</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPacks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-text-secondary">
                  No active packs found.
                </td>
              </tr>
            )}
            {filteredPacks.map((pack) => (
              <tr key={pack.id} className="border-b border-border/70 hover:bg-muted/30">
                <td className="px-3 py-2">{pack.slot?.slotNumber ?? "-"}</td>
                <td className="px-3 py-2">{pack.game.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{pack.packNumber ?? pack.serialNumber ?? "-"}</td>
                <td className="px-3 py-2">{displayedCurrentTicket(pack)}</td>
                <td className="px-3 py-2">${Number(pack.ticketPrice ?? pack.game?.price ?? 0).toFixed(2)}</td>
                <td className="px-3 py-2">{pack.activatedAt ? new Date(pack.activatedAt).toLocaleDateString() : "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    <Link href={`/inventory/packs/${pack.id}`}>
                      <Button size="sm" variant="secondary">
                        View
                      </Button>
                    </Link>
                    {canManageDisplay && <label className="sr-only" htmlFor={`sell-direction-${pack.id}`}>Sell direction for pack {pack.packNumber ?? pack.serialNumber}</label>}
                    {canManageDisplay && <select
                      id={`sell-direction-${pack.id}`}
                      aria-label={`Sell direction for pack ${pack.packNumber ?? pack.serialNumber}`}
                      value={pack.firstOrLastTicket === "LAST" ? "LAST" : "FIRST"}
                      disabled={updatingDirectionId === pack.id}
                      onChange={(event) => { void updateDirection(pack, event.target.value as "FIRST" | "LAST"); }}
                      className="min-h-9 border border-border bg-surface px-2 text-xs font-semibold text-text disabled:opacity-60"
                    >
                      <option value="FIRST">Sell from First</option>
                      <option value="LAST">Sell from Last</option>
                    </select>}
                    {canManageDisplay && <Button size="sm" variant="destructive" onClick={() => openRemoveModal(pack)}>Remove</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StatusBar
        left={<span>Total Active: {packs.length}</span>}
        center={
          <span>
            Low Ticket Alerts: {
              packs.filter((pack) => {
                const current = Number(pack.currentTicketNumber ?? 0);
                return current > 0 && current <= 5;
              }).length
            }
          </span>
        }
        right={<span>Filtered: {filteredPacks.length}</span>}
      />
    </div>

  );

}
