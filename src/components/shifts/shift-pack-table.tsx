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
    currentTicketNumber: number | null;
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
  const lines = shift.lines as ShiftLine[];

  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  function getAutoEndingTicket(line: ShiftLine) {
    const beginning = Number(line.beginningTicket);
    const current =
      line.pack.currentTicketNumber === null || line.pack.currentTicketNumber === undefined
        ? beginning
        : Number(line.pack.currentTicketNumber);
    return Math.min(Math.max(current, 0), beginning);
  }

  async function persistLines() {
    try {
      setSaving(true);

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
            })),
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        alert(data.error);
        return false;
      }

      return true;
    } catch (error) {
      console.error(error);
      alert("Unable to save shift.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveTickets() {
    const ok = await persistLines();
    if (ok) {
      alert("Shift lines saved.");
    }
  }

  async function saveAndCloseShift() {
    try {
      setClosing(true);
      const saved = await persistLines();

      if (!saved) {
        return;
      }

      const res = await fetch("/api/shifts/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shiftId: shift.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Unable to close shift.");
        return;
      }

      alert(
        `Shift closed successfully!\n\nTickets Sold: ${data.totalTickets}\nSales: $${Number(data.totalSales).toFixed(2)}`
      );
      window.location.reload();
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        alert(`Unable to close shift. ${error.message}`);
      } else {
        alert("Unable to close shift.");
      }
    } finally {
      setClosing(false);
    }
  }

  const totalTickets = lines.reduce(
    (sum, line) =>
      sum +
      Math.max(
        line.beginningTicket - getAutoEndingTicket(line),
        0
      ),
    0
  );

  const totalSales = lines.reduce(
    (sum, line) =>
      sum +
      Math.max(
        line.beginningTicket - getAutoEndingTicket(line),
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
                line.beginningTicket - getAutoEndingTicket(line),
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
                    <span className="inline-flex min-w-20 items-center justify-center rounded-lg border bg-surface-soft px-3 py-2 text-center font-mono">
                      {getAutoEndingTicket(line)}
                    </span>
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

      <div className="mt-4 rounded-lg border bg-surface-soft p-3 text-sm">
        <p className="text-emerald-700">
          Ending ticket is automatic and synced from each pack&apos;s current ticket number.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Button
          className="w-full"
          variant="secondary"
          disabled={saving || closing}
          onClick={saveTickets}
        >
          {saving ? "Saving..." : "Save Reconciliation"}
        </Button>
        <Button
          className="w-full"
          disabled={saving || closing}
          onClick={saveAndCloseShift}
        >
          {closing ? "Saving & Closing..." : "Save & Close Shift"}
        </Button>
      </div>
    </Panel>
  );
}