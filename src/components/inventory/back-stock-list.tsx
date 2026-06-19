"use client";

import { useMemo, useState } from "react";
import { Pack } from "@/lib/types";
import { PackRow } from "./pack-row";
import { FilterBar } from "./filter-bar";
import { getGame } from "@/lib/utils";
import { PackageOpen } from "lucide-react";

export function BackStockList({ packs }: { packs: Pack[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return packs;
    const q = query.toLowerCase();
    return packs.filter((p) => {
      const game = getGame(p.gameId);
      return (
        p.serialNumber.toLowerCase().includes(q) ||
        game?.name.toLowerCase().includes(q)
      );
    });
  }, [packs, query]);

  return (
    <div>
      <FilterBar onSearchChange={setQuery} />
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <PackageOpen size={28} className="text-text-tertiary" strokeWidth={1.5} />
          <p className="text-sm font-medium text-text">No packs match that search</p>
          <p className="text-xs text-text-secondary">
            Try a different serial number or game name.
          </p>
        </div>
      ) : (
        <div>
          {filtered.map((pack) => (
            <PackRow key={pack.id} pack={pack} />
          ))}
        </div>
      )}
    </div>
  );
}
