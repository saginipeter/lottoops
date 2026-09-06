"use client";

import { LogOut, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner({ adminName }: { adminName: string }) {
  const [loading, setLoading] = useState(false);
  async function exit() {
    setLoading(true);
    const response = await fetch("/api/platform/impersonate/exit", { method: "POST" });
    if (response.ok) window.location.href = "/platform";
    else setLoading(false);
  }
  return <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:px-5"><span className="flex min-w-0 items-center gap-2"><ShieldAlert size={15} className="shrink-0" /><span className="truncate">Support session active from Platform Admin {adminName}</span></span><Button size="xs" variant="outline" onClick={() => { void exit(); }} disabled={loading}><LogOut size={13} />{loading ? "Exiting..." : "Exit Support Session"}</Button></div>;
}
