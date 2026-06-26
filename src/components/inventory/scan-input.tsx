"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";

interface ScanInputProps {
  onScan: (serial: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * A USB/Bluetooth barcode scanner behaves like a keyboard: it types the
 * decoded serial number into whatever input is focused, then sends Enter.
 * This component stays auto-focused at all times (re-focusing after every
 * scan and on window focus) so a clerk can scan pack after pack without
 * touching the mouse or keyboard at all.
 */
export function ScanInput({ onScan, disabled, placeholder }: ScanInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep focus on the scan field at all times, since a scanner only ever
  // "types" into whatever has focus. Re-focus on mount, after every scan,
  // and whenever the window regains focus (e.g. clerk tabbed away).
  useEffect(() => {
    inputRef.current?.focus();
    function refocus() {
      if (!disabled) inputRef.current?.focus();
    }
    window.addEventListener("focus", refocus);
    return () => window.removeEventListener("focus", refocus);
  }, [disabled]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed) {
        onScan(trimmed);
        setValue("");
      }
    }
  }

  return (
    <div className="relative">
      <ScanLine
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-accent"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
        placeholder={placeholder ?? "Scan pack serial number…"}
        className="w-full rounded-md border-2 border-accent/30 bg-surface py-3 pl-10 pr-3 font-mono text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 transition-colors"
      />
    </div>
  );
}