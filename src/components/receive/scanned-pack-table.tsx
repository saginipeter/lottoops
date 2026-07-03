"use client";

import { Trash2, CheckCircle2, Clock3 } from "lucide-react";

import type { PackWithGame } from "@/lib/types";

import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

interface Props {
  packs: PackWithGame[];
  removePack: (id: string) => void;
}

export function ScannedPackTable({
  packs,
  removePack,
}: Props) {
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
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">

          <thead>
            <tr className="border-b">
              <th className="py-3 text-left text-sm font-semibold">
                Game
              </th>

              <th className="py-3 text-left text-sm font-semibold">
                Pack #
              </th>

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
                  colSpan={7}
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

                <td className="font-mono">
                  {pack.packNumber}
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

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePack(pack.id)}
                  >

                    <Trash2
                      size={18}
                      className="text-red-500"
                    />

                  </Button>

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