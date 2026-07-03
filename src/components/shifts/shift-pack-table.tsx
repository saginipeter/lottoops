"use client";

import { useState } from "react";

import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

interface ShiftLine {
  id: string;
  slotNumber: string;
  beginningTicket: number;
  endingTicket: number | null;
  pack: {
    id: string;
    packNumber: string;
    game: {
      name: string;
      price: number;
    };
  };
}

interface Shift {
  id: string;
  lines: ShiftLine[];
}

interface Props {
  shift: Shift;
}

export default function ShiftPackTable({ shift }: Props) {
  const [lines, setLines] = useState(
    shift.lines.map((line) => ({
      ...line,
      endingTicket:
        line.endingTicket ?? line.beginningTicket,
    }))
  );

  const [loading, setLoading] = useState(false);

  function updateTicket(id: string, value: number) {
    setLines((prev) =>
      prev.map((line) =>
        line.id === id
          ? {
              ...line,
              endingTicket: value,
            }
          : line
      )
    );
  }

  async function saveTickets() {
    try {
      setLoading(true);

      const res = await fetch(
        "/api/shifts/update-lines",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            lines: lines.map((line) => ({
              id: line.id,
              beginningTicket:
                line.beginningTicket,
              endingTicket:
                line.endingTicket,
              price: Number(
                line.pack.game.price
              ),
            })),
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        alert(data.error);
        return;
      }

      alert("Shift lines saved.");
    } catch (error) {
      console.error(error);
      alert("Unable to save shift.");
    } finally {
      setLoading(false);
    }
  }

  const totalTickets = lines.reduce(
    (sum, line) =>
      sum +
      Math.max(
        line.beginningTicket -
          (line.endingTicket ?? 0),
        0
      ),
    0
  );

  const totalSales = lines.reduce(
    (sum, line) =>
      sum +
      Math.max(
        line.beginningTicket -
          (line.endingTicket ?? 0),
        0
      ) *
        Number(line.pack.game.price),
    0
  );

  return (
    <Panel className="p-6">
      <h2 className="mb-6 text-xl font-semibold">
        Shift Reconciliation
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="py-3 text-left">
                Slot
              </th>

              <th className="py-3 text-left">
                Game
              </th>

              <th className="py-3 text-left">
                Pack
              </th>

              <th className="py-3 text-center">
                Beginning
              </th>

              <th className="py-3 text-center">
                Ending
              </th>

              <th className="py-3 text-center">
                Sold
              </th>

              <th className="py-3 text-right">
                Sales
              </th>
            </tr>
          </thead>

          <tbody>
            {lines.map((line) => {
              const sold = Math.max(
                line.beginningTicket -
                  (line.endingTicket ?? 0),
                0
              );

              const sales =
                sold *
                Number(line.pack.game.price);

              return (
                <tr
                  key={line.id}
                  className="border-b"
                >
                  <td className="py-4">
                    {line.slotNumber}
                  </td>

                  <td>
                    {line.pack.game.name}
                  </td>

                  <td>
                    #{line.pack.packNumber}
                  </td>

                  <td className="text-center font-mono">
                    {line.beginningTicket}
                  </td>

                  <td className="text-center">
                    <input
                      type="number"
                      min={0}
                      value={
                        line.endingTicket ?? 0
                      }
                      onChange={(e) =>
                        updateTicket(
                          line.id,
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="w-24 rounded-lg border p-2 text-center"
                    />
                  </td>

                  <td className="text-center font-semibold">
                    {sold}
                  </td>

                  <td className="text-right font-semibold">
                    ${sales.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6">
        <div className="rounded-xl bg-green-50 p-5">
          <div className="text-sm text-gray-500">
            Tickets Sold
          </div>

          <div className="mt-2 text-3xl font-bold text-green-700">
            {totalTickets}
          </div>
        </div>

        <div className="rounded-xl bg-purple-50 p-5">
          <div className="text-sm text-gray-500">
            Sales
          </div>

          <div className="mt-2 text-3xl font-bold text-purple-700">
            ${totalSales.toFixed(2)}
          </div>
        </div>
      </div>

      <Button
        className="mt-8 w-full"
        disabled={loading}
        onClick={saveTickets}
      >
        {loading
          ? "Saving..."
          : "Save Reconciliation"}
      </Button>
    </Panel>
  );
}