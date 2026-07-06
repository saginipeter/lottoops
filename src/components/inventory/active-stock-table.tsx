"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Props {
  packs: any[];
}

export function ActiveStockTable({
  packs,
}: Props) {

  return (

    <div className="overflow-x-auto">

      <table className="w-full">

        <thead className="border-b bg-gray-50">

          <tr>

            <th className="p-3 text-left">Slot</th>

            <th className="p-3 text-left">Game</th>

            <th className="p-3 text-left">Pack</th>

            <th className="p-3 text-left">Current Ticket</th>

            <th className="p-3 text-left">Price</th>

            <th className="p-3 text-left">Activated</th>

            <th className="p-3 text-left">Actions</th>

          </tr>

        </thead>

        <tbody>

          {packs.map((pack) => (

            <tr
              key={pack.id}
              className="border-b hover:bg-gray-50"
            >

              <td className="p-3">

                {pack.slot?.slotNumber ?? "-"}

              </td>

              <td className="p-3">

                {pack.game.name}

              </td>

              <td className="p-3 font-mono">

                {pack.packNumber}

              </td>

              <td className="p-3">

                {pack.currentTicketNumber ?? pack.firstTicket}

              </td>

              <td className="p-3">

                ${pack.ticketPrice}

              </td>

              <td className="p-3">

                {pack.activatedAt
                  ? new Date(pack.activatedAt).toLocaleDateString()
                  : "-"}

              </td>

              <td className="p-3">

                <Link href={`/inventory/packs/${pack.id}`}>

                  <Button
                    size="sm"
                    variant="secondary"
                  >
                    View
                  </Button>

                </Link>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}