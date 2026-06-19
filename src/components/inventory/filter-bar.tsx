"use client";

import { Search } from "lucide-react";
import { useState } from "react";

interface FilterBarProps {
  onSearchChange: (value: string) => void;
}

export function FilterBar({ onSearchChange }: FilterBarProps) {
  const [query, setQuery] = useState("");

  return (
    <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
      <div className="relative flex-1 max-w-sm">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSearchChange(e.target.value);
          }}
          placeholder="Search serial number or game name"
          className="w-full rounded-md border border-border bg-surface-soft py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-tertiary focus:outline-none"
        />
      </div>
    </div>
  );
}
