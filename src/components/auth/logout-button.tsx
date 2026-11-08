"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  className?: string;
  label?: string;
}

export function LogoutButton({ className, label = "Sign out" }: LogoutButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error("Sign-out request failed.");
      // A document navigation discards the old App Router tree and any mounted
      // user-specific client state before another person signs in.
      window.location.replace("/login");
    } catch {
      setError("Unable to sign out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={busy}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-sidebar-text-strong disabled:opacity-60",
          className,
        )}
        title="Sign out"
      >
        <LogOut size={13} />
        {busy ? "Signing out…" : label}
      </button>
      {error && <p role="alert" className="mt-1 px-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
