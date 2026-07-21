"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

interface ReturnedPack {
  id: string;
  serialNumber: string;
  gameNumber?: string | null;
  packNumber?: string | null;
  status: string;
  activeRemovalReason?: string | null;
  activeRemovalReasonText?: string | null;
  removalReason?: string | null;
  removalReasonText?: string | null;
  removalReasonAt?: string | null;
  activeRemovalReasonAt?: string | null;
  game: { name: string };
}

interface ReturnedTicketsListProps {
  packs: ReturnedPack[];
}

export function ReturnedTicketsList({ packs }: ReturnedTicketsListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return packs;
    const term = search.toLowerCase();
    return packs.filter((pack) =>
      (pack.gameNumber ?? "").toLowerCase().includes(term) ||
      (pack.packNumber ?? "").toLowerCase().includes(term) ||
      pack.serialNumber.toLowerCase().includes(term) ||
      pack.game.name.toLowerCase().includes(term)
    );
  }, [packs, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 text-gray-400" size={16} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search game, pack or serial..."
          className="w-full rounded-lg border px-10 py-2.5"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Game</th>
              <th className="p-3 text-left">Pack #</th>
              <th className="p-3 text-left">Serial</th>
              <th className="p-3 text-left">Reason</th>
              <th className="p-3 text-left">Marked Inactive</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No returned/inactive tickets found.
                </td>
              </tr>
            )}
            {filtered.map((pack) => {
              const reason =
                pack.activeRemovalReason ??
                pack.removalReason ??
                "RETURNED";
              const reasonText =
                pack.activeRemovalReasonText ??
                pack.removalReasonText ??
                "";
              const when =
                pack.activeRemovalReasonAt ??
                pack.removalReasonAt ??
                "";
              return (
                <tr key={pack.id} className="border-b">
                  <td className="p-3">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                      INACTIVE
                    </span>
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{pack.game.name}</p>
                    <p className="text-xs text-gray-500">Game #{pack.gameNumber ?? "—"}</p>
                  </td>
                  <td className="p-3 font-mono">{pack.packNumber ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{pack.serialNumber}</td>
                  <td className="p-3">
                    <p className="font-medium">{reason}</p>
                    {reasonText && <p className="text-xs text-gray-500">{reasonText}</p>}
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {when ? new Date(when).toLocaleString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
