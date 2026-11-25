"use client";

import { Trash2, CheckCircle2, Clock3, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { PackWithGame } from "@/lib/types";
import { isDraftPack } from "@/lib/receiving-draft";

import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

interface Props {
  packs: PackWithGame[];
  removePack?: (id: string) => void | Promise<void>;
  editable?: boolean;
  onUpdatePack?: (pack: PackWithGame) => void;
  selectable?: boolean;
  selectedPackIds?: string[];
  onSelectionChange?: (packIds: string[]) => void;
}

export function ScannedPackTable({
  packs,
  removePack,
  editable = false,
  onUpdatePack,
  selectable = false,
  selectedPackIds = [],
  onSelectionChange,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const selectAllRef = useRef<HTMLInputElement>(null);
  const draftPacks = packs.filter(isDraftPack);
  const selectedDraftCount = draftPacks.filter((pack) => selectedPackIds.includes(pack.id)).length;
  const allDraftsSelected = draftPacks.length > 0 && selectedDraftCount === draftPacks.length;
  const someDraftsSelected = selectedDraftCount > 0 && !allDraftsSelected;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someDraftsSelected;
  }, [someDraftsSelected]);

  function toggleAllDraftPacks() {
    if (!onSelectionChange) return;
    onSelectionChange(allDraftsSelected ? [] : draftPacks.map((pack) => pack.id));
  }

  function togglePack(packId: string) {
    if (!onSelectionChange) return;
    onSelectionChange(
      selectedPackIds.includes(packId)
        ? selectedPackIds.filter((id) => id !== packId)
        : [...selectedPackIds, packId]
    );
  }

  async function handleRemove(packId: string) {
    if (!removePack || removingId) return;
    setRemovingId(packId);
    setActionError("");
    try {
      await removePack(packId);
    } catch (error) {
      console.error("Unable to remove scanned pack:", error);
      setActionError(error instanceof Error ? error.message : "Unable to remove this pack from the shipment.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleEdit(pack: PackWithGame) {
    const firstTicket = window.prompt(
      "Edit first ticket number",
      String(pack.firstTicket ?? "")
    );
    if (firstTicket === null) return;

    const ticketPrice = window.prompt(
      "Edit ticket price",
      String(Number(pack.ticketPrice ?? 0))
    );
    if (ticketPrice === null) return;

    const ticketQuantity = window.prompt(
      "Edit ticket quantity",
      String(pack.ticketQuantity ?? 0)
    );
    if (ticketQuantity === null) return;

    const parsedFirstTicket = Number(firstTicket);
    const parsedTicketPrice = Number(ticketPrice);
    const parsedTicketQuantity = Number(ticketQuantity);

    if (!Number.isInteger(parsedFirstTicket) || parsedFirstTicket < 0) {
      alert("First ticket must be a valid whole number.");
      return;
    }

    if (!Number.isFinite(parsedTicketPrice) || parsedTicketPrice <= 0) {
      alert("Ticket price must be greater than zero.");
      return;
    }

    if (!Number.isInteger(parsedTicketQuantity) || parsedTicketQuantity <= 0) {
      alert("Ticket quantity must be a whole number greater than zero.");
      return;
    }

    const expectedQuantity = Number(pack.game.ticketsPerPack);
    const quantityChanged = parsedTicketQuantity !== Number(pack.ticketQuantity ?? expectedQuantity);
    const requiresReason = quantityChanged && parsedTicketQuantity !== expectedQuantity;
    const reason = requiresReason
      ? window.prompt("Enter a reason for this ticket quantity override (required).", "")
      : "";
    if (reason === null) return;
    if (requiresReason && !reason.trim()) {
      alert("A reason is required when changing ticket quantity from the game catalog quantity.");
      return;
    }

    try {
      setEditingId(pack.id);
      const response = await fetch("/api/packs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: pack.id,
          firstTicket: parsedFirstTicket,
          ticketPrice: parsedTicketPrice,
          ticketQuantity: parsedTicketQuantity,
          ...(reason?.trim() ? { reason: reason.trim() } : {}),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Unable to update scanned pack.");
        return;
      }

      onUpdatePack?.(data);
    } catch (error) {
      console.error(error);
      alert("Unable to update scanned pack.");
    } finally {
      setEditingId(null);
    }
  }

  return (
    <Panel className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            Packs Logged This Shipment
          </h3>

          <p className="text-sm text-gray-500">
            {packs.length} pack{packs.length !== 1 && "s"} scanned
          </p>
        </div>
        {selectable && draftPacks.length > 0 && (
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium">
            <input
              ref={selectAllRef}
              type="checkbox"
              aria-label="Select all scanned packs"
              checked={allDraftsSelected}
              onChange={toggleAllDraftPacks}
              className="h-4 w-4"
            />
            Select All
          </label>
        )}
      </div>

      <div className="overflow-x-auto">
        {actionError && <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{actionError}</p>}
        <table className="w-full">

          <thead>
            <tr className="border-b">
              {selectable && <th className="w-12 py-3 text-left text-sm font-semibold" aria-label="Selection" />}
              <th className="py-3 text-left text-sm font-semibold">
                Game
              </th>

              <th className="py-3 text-left text-sm font-semibold">Pack Barcode</th>

              <th className="py-3 text-left text-sm font-semibold">
                First Ticket
              </th>

              <th className="py-3 text-left text-sm font-semibold">
                Price
              </th>

              <th className="py-3 text-left text-sm font-semibold">
                Quantity
              </th>

              <th className="py-3 text-left text-sm font-semibold">
                Status
              </th>

              <th className="py-3 text-right text-sm font-semibold">
                Action
              </th>
            </tr>
          </thead>

          <tbody>

            {packs.length === 0 && (
              <tr>
                <td
                  colSpan={7 + Number(selectable)}
                  className="py-12 text-center text-gray-400"
                >
                  No packs scanned yet.
                </td>
              </tr>
            )}

            {packs.map((pack) => (

              <tr
                key={pack.id}
                className="border-b hover:bg-gray-50"
              >
                {selectable && (
                  <td className="py-4">
                    <input
                      type="checkbox"
                      aria-label={`Select pack ${pack.serialNumber}`}
                      checked={selectedPackIds.includes(pack.id)}
                      disabled={!isDraftPack(pack)}
                      onChange={() => togglePack(pack.id)}
                      className="h-4 w-4"
                    />
                  </td>
                )}

                <td className="py-4">

                  <div>

                    <div className="font-semibold">
                      {pack.game.gameNumber}
                    </div>

                    <div className="text-xs text-gray-500">
                      {pack.game.name}
                    </div>

                  </div>

                </td>

                <td className="max-w-48 break-all py-4 font-mono text-sm" aria-label={`Pack barcode ${pack.serialNumber}`}>
                  {pack.serialNumber}
                </td>

                <td className="font-mono">
                  {pack.firstTicket}
                </td>

                <td>
                  ${Number(pack.ticketPrice).toFixed(2)}
                </td>

                <td>
                  {pack.ticketQuantity}
                </td>

                <td>

                  {pack.status === "BACK_STOCK" ? (

                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">

                      <CheckCircle2 size={14} />

                      Logged

                    </span>

                  ) : (

                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">

                      <Clock3 size={14} />

                      {pack.status}

                    </span>

                  )}

                </td>

                <td className="text-right">

                  {editable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={editingId === pack.id}
                      onClick={() => handleEdit(pack)}
                    >
                      <Pencil
                        size={16}
                        className="text-blue-600"
                      />
                    </Button>
                  )}

                  {removePack && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove pack ${pack.serialNumber}`}
                      disabled={editingId === pack.id || removingId !== null}
                      onClick={() => void handleRemove(pack.id)}
                    >
                      <Trash2
                        size={18}
                        className="text-red-500"
                      />
                    </Button>
                  )}

                </td>

              </tr>

            ))}

          </tbody>

        </table>
      </div>

      {packs.length > 0 && (
        <div className="mt-6 rounded-lg bg-purple-50 p-4">

          <div className="flex items-center justify-between">

            <div>

              <div className="font-semibold">
                Total Packs
              </div>

              <div className="text-sm text-gray-500">
                Ready for review
              </div>

            </div>

            <div className="text-3xl font-bold text-purple-700">
              {packs.length}
            </div>

          </div>

        </div>
      )}

    </Panel>
  );
}
