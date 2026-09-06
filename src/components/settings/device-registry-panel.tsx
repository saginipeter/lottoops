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
      <div className="mt-5 space-y-2">{loading ? <p className="text-sm text-text-secondary">Loading registered devices...</p> : devices.length === 0 ? <p className="text-sm text-text-secondary">No devices registered yet.</p> : devices.map((device) => <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"><div><p className="font-medium text-text">{device.terminalId} · {device.deviceType}</p><p className="text-xs text-text-secondary">{device.scannerModel || "Scanner model not set"}{device.scannerSerial ? ` · ${device.scannerSerial}` : ""}</p></div><Button size="sm" variant="outline" onClick={() => { void toggle(device); }}><Power size={14} />{device.active ? "Deactivate" : "Activate"}</Button></div>)}</div>
    </Panel>
  );
}
