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
  canOverrideClose: boolean;
}

export default function ShiftPackTable({ shift, canOverrideClose }: Props) {
  const [lines, setLines] = useState(
    shift.lines.map((line) => ({
      ...line,
      endingTicket: line.endingTicket ?? "",
    }))
  );

  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  function updateTicket(id: string, value: number | "") {
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
              beginningTicket:
                line.beginningTicket,
              endingTicket:
                line.endingTicket === "" ? null : Number(line.endingTicket),
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

      const missingCount = lines.filter((line) => line.endingTicket === "").length;
      let allowIncompleteClose = false;
      let overrideReason: string | undefined;

      if (missingCount > 0) {
        if (!canOverrideClose) {
          alert(`Cannot close shift. ${missingCount} line(s) are missing ending tickets.`);
          return;
        }

        const reason = window.prompt(
          `${missingCount} line(s) are missing ending tickets.\nEnter manager override reason to close shift:`
        );
        if (!reason || reason.trim().length < 5) {
          alert("Override reason is required (at least 5 characters).");
          return;
        }

        allowIncompleteClose = true;
        overrideReason = reason.trim();
      }

      const res = await fetch("/api/shifts/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shiftId: shift.id,
          allowIncompleteClose,
          overrideReason,
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
      alert("Unable to close shift.");
    } finally {
      setClosing(false);
    }
  }

  const totalTickets = lines.reduce(
    (sum, line) =>
      sum +
      Math.max(
        line.beginningTicket -
          (line.endingTicket === "" ? line.beginningTicket : Number(line.endingTicket)),
        0
      ),
    0
  );

  const totalSales = lines.reduce(
    (sum, line) =>
      sum +
      Math.max(
        line.beginningTicket -
          (line.endingTicket === "" ? line.beginningTicket : Number(line.endingTicket)),
        0
      ) *
        Number(line.pack.game.price),
    0
  );

  const missingCount = lines.filter((line) => line.endingTicket === "").length;

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
                  (line.endingTicket === "" ? line.beginningTicket : Number(line.endingTicket)),
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
                      max={line.beginningTicket}
                      value={
                        line.endingTicket
                      }
                      onChange={(e) =>
                        updateTicket(
                          line.id,
                          e.target.value === ""
                            ? ""
                            : Number(e.target.value)
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

      <div className="mt-4 rounded-lg border bg-surface-soft p-3 text-sm">
        {missingCount > 0 ? (
          <p className="text-amber-700">
            {missingCount} line(s) missing ending ticket.{" "}
            {canOverrideClose
              ? "Manager override can close with reason."
              : "Complete all lines before closing shift."}
          </p>
        ) : (
          <p className="text-emerald-700">All lines have ending tickets entered.</p>
        )}
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