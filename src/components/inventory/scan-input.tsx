"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine, Keyboard, Plus } from "lucide-react";

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
 *
 * The same field also supports manual entry — a clerk can type a serial
 * by hand and either press Enter or click "Add" — for a damaged barcode,
 * a scanner that's out of batteries, or any pack without a scannable code.
 * There's no separate manual-entry mode under the hood: a scan and a typed
 * entry are mechanically identical (both are "text + Enter"), so this is
 * mainly about making that option visible rather than adding new logic.
 */
export function ScanInput({ onScan, disabled, placeholder }: ScanInputProps) {
  const [value, setValue] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep focus on the scan field at all times, since a scanner only ever
  // "types" into whatever has focus. Re-focus on mount, after every scan,
  // and whenever the window regains focus (e.g. clerk tabbed away).
  // Skipped while manual entry is active, so typing isn't fought over.
  useEffect(() => {
    if (manualMode) return;
    inputRef.current?.focus();
    function refocus() {
      if (!disabled) inputRef.current?.focus();
    }
    window.addEventListener("focus", refocus);
    return () => window.removeEventListener("focus", refocus);
  }, [disabled, manualMode]);

  function submit() {
    const trimmed = value.trim();
    if (trimmed) {
      onScan(trimmed);
      setValue("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div>
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          {manualMode ? (
            <Keyboard
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
          ) : (
            <ScanLine
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-accent"
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            autoComplete="off"
            placeholder={
              placeholder
                ? placeholder
                : manualMode
                ? "Type the pack serial number…"
                : "Scan pack serial number…"
            }
            className="w-full rounded-md border-2 border-accent/30 bg-surface py-3 pl-10 pr-3 font-mono text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 transition-colors"
          />
        </div>

        {manualMode && (
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="flex items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            <Plus size={15} />
            Add
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setManualMode((v) => !v)}
        disabled={disabled}
        className="mt-2 flex items-center gap-1.5 text-xs text-text-tertiary hover:text-accent transition-colors disabled:opacity-40"
      >
        {manualMode ? (
          <>
            <ScanLine size={12} />
            Switch back to scanning
          </>
        ) : (
          <>
            <Keyboard size={12} />
            No scanner handy? Enter a serial number manually
          </>
        )}
      </button>
    </div>
  );
}