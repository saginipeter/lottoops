"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface LockedPack {
  id: string;
  serialNumber: string;
  gameNumber: string | null;
  sequenceLockExpectedTicket: number | null;
  sequenceLockScannedTicket: number | null;
  sequenceLockedAt: string | null;
  game: { name: string };
  slot: { slotNumber: string } | null;
}

export function LockedPacksPanel() {
  const [packs, setPacks] = useState<LockedPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/packs/sequence-lock");
      if (response.ok) setPacks(await response.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function resolve(pack: LockedPack) {
    const reason = window.prompt("Enter the manager resolution reason");
    if (!reason?.trim()) return;
    const response = await fetch("/api/packs/sequence-lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId: pack.id, reason }),
    });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Unable to unlock pack."); return; }
    setMessage("Pack unlocked and resolution recorded.");
    load();
  }

  if (loading || packs.length === 0) return null;

  return (
    <Panel className="mt-5 border-red-200 bg-red-50 p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="text-red-700" size={18} />
        <div><h3 className="font-semibold text-red-900">Locked Packs Requiring Review</h3><p className="text-xs text-red-800">Sales remain blocked until each discrepancy is resolved.</p></div>
      </div>
      <div className="mt-3 space-y-2">
        {packs.map((pack) => (
          <div key={pack.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-white p-3">
            <div className="text-sm"><p className="font-semibold">Display {pack.slot?.slotNumber ?? "Unassigned"} · {pack.game.name}</p><p className="font-mono text-xs text-text-secondary">Pack {pack.serialNumber} · Expected {pack.sequenceLockExpectedTicket} · Scanned {pack.sequenceLockScannedTicket}</p></div>
            <Button size="sm" onClick={() => resolve(pack)}><Unlock size={14} /> Resolve & Unlock</Button>
          </div>
        ))}
      </div>
      {message && <p role="status" className="mt-2 text-sm font-medium text-red-800">{message}</p>}
    </Panel>
  );
}
