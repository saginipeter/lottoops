"use client";

import { useEffect, useState } from "react";
import { Check, Cpu, Loader2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface Device {
  id: string;
  terminalId: string;
  deviceType: string;
  scannerModel: string | null;
  scannerSerial: string | null;
  scannerSettings: string | null;
  active: boolean;
  lastSeenAt?: string | null;
  isPaired?: boolean;
  healthStatus?: "ONLINE" | "STALE" | "OFFLINE" | "INACTIVE";
}

export function DeviceRegistryPanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [terminalId, setTerminalId] = useState("");
  const [deviceType, setDeviceType] = useState("REGISTER");
  const [scannerModel, setScannerModel] = useState("");
  const [scannerSerial, setScannerSerial] = useState("");
  const [scannerSettings, setScannerSettings] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pairing, setPairing] = useState<{ code: string; terminalId: string; pairingExpiresAt: string } | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/devices", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load devices.");
      setDevices(data.devices ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load devices.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => { void load(); }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ terminalId, deviceType, scannerModel, scannerSerial, scannerSettings }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to register device.");
      setTerminalId(""); setScannerModel(""); setScannerSerial(""); setScannerSettings("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to register device.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(device: Device) {
    const response = await fetch("/api/devices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: device.id, active: !device.active }) });
    if (response.ok) await load();
    else setError("Unable to update device.");
  }

  async function checkIn(device: Device) {
    const response = await fetch("/api/devices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: device.id, checkIn: true }) });
    if (response.ok) await load(); else setError("Unable to check in device.");
  }

  async function generatePairingCode(device: Device) {
    setError("");
    const response = await fetch("/api/devices/pairing-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: device.id }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to generate pairing code.");
    else setPairing(data.pairing);
  }

  return (
    <Panel className="p-5">
      <div className="flex items-start gap-3"><Cpu size={20} className="mt-0.5 text-accent" /><div><h3 className="text-base font-semibold text-text">Terminal &amp; Scanner Configuration</h3><p className="mt-1 text-sm text-text-secondary">Register each workstation and its barcode scanner for this store.</p></div></div>
      <form onSubmit={register} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input required value={terminalId} onChange={(event) => setTerminalId(event.target.value)} placeholder="Terminal ID, e.g. T1" className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
        <select value={deviceType} onChange={(event) => setDeviceType(event.target.value)} className="rounded-md border border-border bg-surface px-3 py-2 text-sm"><option value="REGISTER">Register</option><option value="PHONE">Phone</option><option value="DISPLAY">Customer Display</option></select>
        <input value={scannerModel} onChange={(event) => setScannerModel(event.target.value)} placeholder="Scanner model" className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
        <input value={scannerSerial} onChange={(event) => setScannerSerial(event.target.value)} placeholder="Scanner serial number" className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
        <input value={scannerSettings} onChange={(event) => setScannerSettings(event.target.value)} placeholder="Scanner settings or notes" className="rounded-md border border-border bg-surface px-3 py-2 text-sm sm:col-span-2" />
        <div className="flex justify-end sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}{saving ? "Saving..." : "Register Device"}</Button></div>
      </form>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {pairing && <div className="mt-4 border border-accent/30 bg-accent-soft p-4"><p className="text-xs font-semibold uppercase tracking-wide text-accent">Pair terminal {pairing.terminalId} within 10 minutes</p><p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em] text-text">{pairing.code}</p><p className="mt-1 text-xs text-text-secondary">Give this code to the employee on the device that will operate this terminal.</p></div>}
      <div className="mt-5 space-y-2">{loading ? <p className="text-sm text-text-secondary">Loading registered devices...</p> : devices.length === 0 ? <p className="text-sm text-text-secondary">No devices registered yet.</p> : devices.map((device) => { const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt) : null; const status = device.healthStatus ?? (device.active ? "OFFLINE" : "INACTIVE"); const statusClass = status === "ONLINE" ? "bg-emerald-100 text-emerald-800" : status === "STALE" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"; return <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"><div><p className="font-medium text-text">{device.terminalId} · {device.deviceType}</p><p className="text-xs text-text-secondary">{device.scannerModel || "Scanner model not set"}{device.scannerSerial ? ` · ${device.scannerSerial}` : ""}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-xs"><span className={`px-2 py-0.5 font-semibold ${statusClass}`}>{status}</span><span className="text-text-tertiary">{lastSeen ? `Last seen ${lastSeen.toLocaleString()}` : "Never checked in"}</span><span className="text-text-tertiary">{device.isPaired ? "Paired" : "Not paired"}</span></div></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { void generatePairingCode(device); }}>Pair Device</Button><Button size="sm" variant="outline" onClick={() => { void checkIn(device); }}>Check In</Button><Button size="sm" variant="outline" onClick={() => { void toggle(device); }}><Power size={14} />{device.active ? "Deactivate" : "Activate"}</Button></div></div>; })}</div>
    </Panel>
  );
}
