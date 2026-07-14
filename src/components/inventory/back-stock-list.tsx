"use client";

import { useMemo, useState } from "react";
import { Search, Trash2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivatePackModal } from "./activate-pack-modal";
import { RemoveBackstockPackModal } from "./remove-backstock-pack-modal";

interface BackStockListProps {
  packs: any[];
  slots: Array<{ id: string; slotNumber: string; occupied: boolean }>;
}

export function BackStockList({ packs, slots }: BackStockListProps) {
  const [search, setSearch] = useState("");
  const [selectedPack, setSelectedPack] = useState<any>(null);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);

  const filteredPacks = useMemo(() => {
    if (!search) return packs;

    const term = search.toLowerCase();

    return packs.filter((pack) =>
      pack.game.gameNumber.toLowerCase().includes(term) ||
      pack.serialNumber.toLowerCase().includes(term) ||
      pack.shipment?.invoiceNumber?.toLowerCase().includes(term)
    );
  }, [packs, search]);

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
    <div className="space-y-5">
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

      {/* Search */}

      <div className="relative max-w-md">

        <Search
          className="absolute left-3 top-3 text-gray-400"
          size={18}
        />

        <input
          className="w-full rounded-lg border pl-10 pr-4 py-2"
          placeholder="Search Game, Pack or Invoice..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

      </div>

      {/* Table */}

      <div className="overflow-x-auto">

        <table className="min-w-full border-collapse">

          <thead>

            <tr className="border-b bg-gray-50">

              <th className="p-3 text-left">Game</th>

              <th className="p-3 text-left">Pack</th>

              <th className="p-3 text-left">Invoice</th>

              <th className="p-3 text-left">Price</th>

              <th className="p-3 text-left">Quantity</th>

              <th className="p-3 text-left">Received</th>

              <th className="p-3 text-left">Status</th>

              <th className="p-3 text-right">Actions</th>

            </tr>

          </thead>

          <tbody>

            {filteredPacks.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="p-8 text-center text-gray-500"
                >
                  No packs found.
                </td>
              </tr>
            )}

            {filteredPacks.map((pack) => (
              <tr
                key={pack.id}
                className="border-b hover:bg-gray-50"
              >
                <td className="p-3 font-semibold">
                  {pack.game.gameNumber}
                </td>

                <td className="p-3 font-mono">
                  {pack.serialNumber}
                </td>

                <td className="p-3">
                  {pack.shipment?.invoiceNumber || "-"}
                </td>

                <td className="p-3">
                  ${Number(pack.game.price).toFixed(2)}
                </td>

                <td className="p-3">
                  {pack.game.ticketsPerPack}
                </td>

                <td className="p-3">
                  {new Date(pack.receivedAt).toLocaleDateString()}
                </td>

                <td className="p-3">

                  <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                    BACK STOCK
                  </span>

                </td>

                <td className="p-3">

                  <div className="flex justify-end gap-2">

                    <Button
                      size="sm"
                      onClick={() => openActivateModal(pack)}
                    >
                      <PlayCircle size={16} />
                      Activate
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openRemoveModal(pack)}
                    >
                      <Trash2 size={16} />
                      Remove
                    </Button>

                  </div>

                </td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}