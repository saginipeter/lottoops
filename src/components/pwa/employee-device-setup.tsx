"use client";

import { useEffect, useState } from "react";
import { Download, KeyRound, RefreshCw, Smartphone } from "lucide-react";
import type { LottoOpsInstallPromptEvent } from "@/components/pwa/service-worker-registration";

function getDeviceKey() {
  const key = window.localStorage.getItem("lottoops:device-key");
  if (key) return key;
  const next = `device_${crypto.randomUUID()}_${crypto.randomUUID()}`;
  window.localStorage.setItem("lottoops:device-key", next);
  return next;
}

export function EmployeeDeviceSetup({ terminalId }: { terminalId: string }) {
  const [installed, setInstalled] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [code, setCode] = useState("");
  const [paired, setPaired] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const detectInstalled = () => {
      setInstalled(
        window.matchMedia("(display-mode: standalone)").matches ||
          Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
      );
    };
    const loadInstallPrompt = () => setInstallEvent(window.__lottoOpsInstallPrompt ?? null);

    detectInstalled();
    loadInstallPrompt();
    window.addEventListener("lottoops-install-prompt-ready", loadInstallPrompt);
    window.addEventListener("lottoops-app-installed", detectInstalled);
    return () => {
      window.removeEventListener("lottoops-install-prompt-ready", loadInstallPrompt);
      window.removeEventListener("lottoops-app-installed", detectInstalled);
    };
  }, []);

  async function install() {
    if (installed) {
      setMessage("LottoOps is already installed on this device.");
      return;
    }
    if (!installEvent) {
      setMessage("Install from your browser menu. On iPhone, choose Share, then Add to Home Screen.");
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    window.__lottoOpsInstallPrompt = undefined;
    setInstallEvent(null);
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setMessage("LottoOps was installed successfully.");
    } else {
      setMessage("Installation was canceled. Select Install app to try again when the browser offers it.");
    }
  }

  async function pair() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/devices/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ terminalId, code, deviceKey: getDeviceKey() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to pair this device.");
      setPaired(true); setCode(""); setMessage(`This device is paired to ${terminalId}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to pair this device."); }
    finally { setSaving(false); }
  }

  return <section className="mt-4 border border-border bg-surface p-4" aria-label="Device setup">
    <div className="flex items-start gap-3"><Smartphone size={20} className="mt-0.5 text-accent" /><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Device setup</p><h2 className="text-base font-semibold text-text">Install and authorize this device</h2><p className="mt-1 text-xs text-text-secondary">Install LottoOps for quick access, then enter the six-digit code supplied by your manager.</p></div></div>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { void install(); }} className="inline-flex min-h-10 items-center gap-2 border border-border bg-surface-soft px-3 text-xs font-semibold text-text"><Download size={15} />{installed ? "App installed" : "Install app"}</button>{paired && <span className="inline-flex min-h-10 items-center gap-2 bg-success-soft px-3 text-xs font-semibold text-success-soft-text"><KeyRound size={15} />Paired</span>}</div>
    {!paired && <div className="mt-3 flex max-w-sm gap-2"><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className="min-h-10 min-w-0 flex-1 border border-border bg-surface px-3 text-sm font-mono" /><button type="button" onClick={() => { void pair(); }} disabled={saving || code.length !== 6} className="inline-flex min-h-10 items-center gap-2 bg-accent px-3 text-xs font-semibold text-white disabled:opacity-50"><RefreshCw size={14} className={saving ? "animate-spin" : ""} />Pair</button></div>}
    {message && <p role="status" className="mt-2 text-xs font-semibold text-text-secondary">{message}</p>}
  </section>;
}

type BeforeInstallPromptEvent = LottoOpsInstallPromptEvent;
