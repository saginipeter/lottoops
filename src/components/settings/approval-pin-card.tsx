"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

export function ApprovalPinCard() {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadState() {
    const res = await fetch("/api/settings/approval-pin");
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Unable to load approval PIN settings.");
    }
    setConfigured(Boolean(data.configured));
    setUpdatedAt(data.updatedAt ? String(data.updatedAt) : null);
  }

  useEffect(() => {
    loadState().catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to load approval PIN settings.");
    });
  }, []);

  async function savePin() {
    setError("");
    setSuccess("");

    if (!/^\d{4,8}$/.test(pin)) {
      setError("PIN must be 4 to 8 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PIN confirmation does not match.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/settings/approval-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, confirmPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to save approval PIN.");
        return;
      }

      setSuccess("Approval PIN saved.");
      setPin("");
      setConfirmPin("");
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save approval PIN.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel className="h-full p-5">
      <div className="mb-3 inline-flex rounded-lg bg-emerald-100 p-2 text-emerald-700">
        <ShieldCheck size={18} />
      </div>
      <h3 className="text-base font-semibold text-text">Approval PIN</h3>
      <p className="mt-1 text-sm text-text-secondary">
        Set the manager approval PIN used when reversing a rejected live scan sale.
      </p>

      <div className="mt-3 rounded-md bg-surface-soft p-3 text-xs text-text-secondary">
        Status: {configured ? "Configured" : "Not configured"}
        {updatedAt ? ` • Updated ${new Date(updatedAt).toLocaleString()}` : ""}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">New PIN</label>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="4 to 8 digits"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">Confirm PIN</label>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            placeholder="Re-enter PIN"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      {success && <p className="mt-3 text-xs text-emerald-700">{success}</p>}

      <div className="mt-4">
        <Button onClick={savePin} disabled={loading}>
          {loading ? "Saving..." : configured ? "Update PIN" : "Set PIN"}
        </Button>
      </div>
    </Panel>
  );
}

