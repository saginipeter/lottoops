"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Trash2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { ActivatePackModal } from "./activate-pack-modal";
import { RemoveBackstockPackModal } from "./remove-backstock-pack-modal";

interface BackStockListProps {
  packs: any[];
  slots: Array<{ id: string; slotNumber: string; occupied: boolean }>;
  canManageBackstock: boolean;
}

export function BackStockList({ packs, slots, canManageBackstock }: BackStockListProps) {
  const [search, setSearch] = useState("");
  const [selectedPack, setSelectedPack] = useState<any>(null);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredPacks = useMemo(() => {
    if (!search) return packs;

    const term = search.toLowerCase();

    return packs.filter((pack) =>
      pack.game.gameNumber.toLowerCase().includes(term) ||
      pack.serialNumber.toLowerCase().includes(term) ||
      pack.shipment?.invoiceNumber?.toLowerCase().includes(term)
    );
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

  function openActivateModal(pack: any) {
    setSelectedPack(pack);
    setActivateModalOpen(true);
  }

  function openRemoveModal(pack: any) {
    setSelectedPack(pack);
    setRemoveModalOpen(true);
  }

  function handleSuccess() {
    // Reload the page to reflect changes
    location.reload();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Modals */}
      <ActivatePackModal
        pack={selectedPack}
        isOpen={activateModalOpen}
        onClose={() => setActivateModalOpen(false)}
        onSuccess={handleSuccess}
        slots={slots}
      />

      <RemoveBackstockPackModal
        pack={selectedPack}
        isOpen={removeModalOpen}
        onClose={() => setRemoveModalOpen(false)}
        onSuccess={handleSuccess}
      />

      <PageToolbar
        left={
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-text-tertiary" size={16} />
            <input
              ref={searchInputRef}
              className="h-8 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              placeholder="Search game, pack, or invoice"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
        center={<span>Ctrl+F Search | Esc Clear</span>}
        right={<span className="text-xs text-text-tertiary">{filteredPacks.length} visible</span>}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted/60">
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="px-3 py-2">Game</th>
              <th className="px-3 py-2">Pack</th>
              <th className="px-3 py-2">Invoice</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Received</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPacks.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-text-secondary">
                  No packs found.
                </td>
              </tr>
            )}

            {filteredPacks.map((pack) => (
              <tr key={pack.id} className="border-b border-border/70 hover:bg-muted/30">
                <td className="px-3 py-2 font-semibold">{pack.game.gameNumber}</td>
                <td className="px-3 py-2 font-mono text-xs">{pack.serialNumber}</td>
                <td className="px-3 py-2">{pack.shipment?.invoiceNumber || "-"}</td>
                <td className="px-3 py-2">${Number(pack.ticketPrice ?? pack.game.price).toFixed(2)}</td>
                <td className="px-3 py-2">{pack.ticketQuantity ?? pack.game.ticketsPerPack}</td>
                <td className="px-3 py-2">{new Date(pack.receivedAt).toLocaleDateString()}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-700">
                    BACK STOCK
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    {canManageBackstock && (
                      <>
                        <Button size="sm" onClick={() => openActivateModal(pack)}>
                          <PlayCircle size={14} />
                          Activate
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => openRemoveModal(pack)}>
                          <Trash2 size={14} />
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StatusBar
        left={<span>Total Back Stock: {packs.length}</span>}
        center={<span>Available Slots: {slots.filter((slot) => !slot.occupied).length}</span>}
        right={<span>Filtered: {filteredPacks.length}</span>}
      />
    </div>
  );
}