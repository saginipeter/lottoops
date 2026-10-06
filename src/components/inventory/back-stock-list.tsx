"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, PlayCircle, Search, SquarePen, Trash2 } from "lucide-react";
import type { Pack, Game, Shipment } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { ActivatePackModal } from "./activate-pack-modal";
import { RemoveBackstockPackModal } from "./remove-backstock-pack-modal";
import { EditInvoiceModal } from "./edit-invoice-modal";

type BackStockPack = Pack & { game: Game; shipment: Shipment | null };

interface BackStockListProps {
  packs: BackStockPack[];
  slots: Array<{ id: string; slotNumber: string; occupied: boolean }>;
  canManageBackstock: boolean;
}

interface InvoiceGroup {
  key: string;
  shipmentId: string | null;
  invoiceNumber: string;
  shipmentConfirmationNumber: string | null;
  packs: BackStockPack[];
}

export function BackStockList({ packs, slots, canManageBackstock }: BackStockListProps) {
  const [search, setSearch] = useState("");
  const [selectedPack, setSelectedPack] = useState<BackStockPack | null>(null);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [editInvoiceGroup, setEditInvoiceGroup] = useState<InvoiceGroup | null>(null);
  const [editInvoiceModalOpen, setEditInvoiceModalOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
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

  // Cascading grouping: every pack under the same invoice/shipment is nested together,
  // so correcting the invoice on the group updates all of its packs at once.
  const invoiceGroups = useMemo(() => {
    const groups = new Map<string, InvoiceGroup>();

    for (const pack of filteredPacks) {
      const shipmentId = pack.shipmentId ?? pack.shipment?.id ?? null;
      const invoiceNumber = pack.shipment?.invoiceNumber || "No Invoice";
      const key = shipmentId ?? `no-shipment:${invoiceNumber}`;

      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          shipmentId,
          invoiceNumber,
          shipmentConfirmationNumber: pack.shipment?.shipmentConfirmationNumber ?? null,
          packs: [],
        };
        groups.set(key, group);
      }
      group.packs.push(pack);
    }

    return Array.from(groups.values()).sort((a, b) => {
      const aDate = new Date(a.packs[0]?.receivedAt ?? 0).getTime();
      const bDate = new Date(b.packs[0]?.receivedAt ?? 0).getTime();
      return bDate - aDate;
    });
  }, [filteredPacks]);

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

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openActivateModal(pack: BackStockPack) {
    setSelectedPack(pack);
    setActivateModalOpen(true);
  }

  function openRemoveModal(pack: BackStockPack) {
    setSelectedPack(pack);
    setRemoveModalOpen(true);
  }

  function openEditInvoiceModal(group: InvoiceGroup) {
    if (!group.shipmentId) return;
    setEditInvoiceGroup(group);
    setEditInvoiceModalOpen(true);
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

      <EditInvoiceModal
        shipment={
          editInvoiceGroup?.shipmentId
            ? {
                id: editInvoiceGroup.shipmentId,
                invoiceNumber: editInvoiceGroup.invoiceNumber,
                shipmentConfirmationNumber: editInvoiceGroup.shipmentConfirmationNumber,
              }
            : null
        }
        packCount={editInvoiceGroup?.packs.length ?? 0}
        isOpen={editInvoiceModalOpen}
        onClose={() => setEditInvoiceModalOpen(false)}
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

      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
        {invoiceGroups.length === 0 ? <div className="flex min-h-[220px] items-center justify-center border-2 border-dashed border-border text-center text-text-secondary">No packs found.</div> : <div className="space-y-4">{invoiceGroups.map((group) => {
          const collapsed = collapsedGroups.has(group.key);
          return <section key={group.key} className="border border-border bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-soft p-3 sm:p-4">
              <button type="button" onClick={() => toggleGroup(group.key)} className="flex min-h-11 items-center gap-2 text-left font-bold text-text">
                {collapsed ? <ChevronRight size={19} /> : <ChevronDown size={19} />}
                <span>Invoice: {group.invoiceNumber}</span>
                <span className="bg-purple-100 px-2 py-1 text-[11px] font-bold text-purple-700">{group.packs.length} pack{group.packs.length === 1 ? "" : "s"}</span>
              </button>
              {canManageBackstock && group.shipmentId && <Button size="sm" variant="outline" onClick={() => openEditInvoiceModal(group)}><SquarePen size={14} /> Correct Invoice</Button>}
            </div>
            {!collapsed && <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">{group.packs.map((pack) => <article key={pack.id} className="border border-border bg-white p-4 shadow-[0_2px_0_rgba(23,35,63,0.08)]"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Game</p><p className="mt-1 text-xl font-bold text-text">{pack.game.gameNumber}</p></div><span className="bg-yellow-100 px-2 py-1 text-[10px] font-bold text-yellow-700">BACK STOCK</span></div><p className="mt-3 break-all font-mono text-xs text-text-secondary">{pack.serialNumber}</p><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="border border-border bg-surface-soft p-2"><p className="text-[10px] text-text-tertiary">Price</p><p className="font-bold text-text">${Number(pack.ticketPrice ?? pack.game.price).toFixed(2)}</p></div><div className="border border-border bg-surface-soft p-2"><p className="text-[10px] text-text-tertiary">Tickets</p><p className="font-bold text-text">{pack.ticketQuantity ?? pack.game.ticketsPerPack}</p></div></div><p className="mt-3 text-[11px] text-text-tertiary">Received {new Date(pack.receivedAt).toLocaleDateString()}</p>{canManageBackstock && <div className="mt-4 grid grid-cols-2 gap-2"><Button className="min-h-11" onClick={() => openActivateModal(pack)}><PlayCircle size={15} /> Activate</Button><Button variant="destructive" className="min-h-11" onClick={() => openRemoveModal(pack)}><Trash2 size={15} /> Remove</Button></div>}</article>)}</div>}
          </section>;
        })}</div>}
      </div>

      <StatusBar
        left={<span>Total Back Stock: {packs.length}</span>}
        center={<span>Available Slots: {slots.filter((slot) => !slot.occupied).length}</span>}
        right={<span>Filtered: {filteredPacks.length}</span>}
      />
    </div>
  );
}
