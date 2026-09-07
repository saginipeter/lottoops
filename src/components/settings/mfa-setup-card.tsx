"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export function MfaSetupCard() {
  const [uri, setUri] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function begin() {
    setLoading(true); setMessage("");
    const response = await fetch("/api/auth/mfa/setup", { method: "POST" });
    const data = await response.json();
    if (response.ok) { setUri(data.uri); setSecret(data.secret); } else setMessage(data.error || "Unable to start MFA setup.");
    setLoading(false);
  }

  async function verify() {
    setLoading(true); setMessage("");
    const response = await fetch("/api/auth/mfa/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await response.json();
    if (response.ok) { setEnabled(true); setMessage("MFA is enabled for this account."); } else setMessage(data.error || "Invalid authenticator code.");
    setLoading(false);
  }

  async function disable() {
    setLoading(true);
    const response = await fetch("/api/auth/mfa/setup", { method: "DELETE" });
    if (response.ok) { setEnabled(false); setUri(""); setSecret(""); setMessage("MFA disabled. Sign in again to continue."); }
    else setMessage("Unable to disable MFA.");
    setLoading(false);
  }

  return <Panel className="p-5"><div className="flex items-start gap-2"><KeyRound size={18} className="mt-0.5 text-accent" /><div><h3 className="text-base font-semibold text-text">Multi-factor authentication</h3><p className="mt-1 text-sm text-text-secondary">Protect your account with a time-based authenticator code.</p></div></div>{enabled ? <div className="mt-4 flex flex-wrap items-center gap-3"><p className="text-sm font-semibold text-emerald-700">MFA enabled.</p><Button size="sm" variant="outline" onClick={() => { void disable(); }} disabled={loading}>Disable MFA</Button></div> : !uri ? <Button className="mt-4" onClick={() => { void begin(); }} disabled={loading}>{loading && <Loader2 size={14} className="animate-spin" />}{loading ? "Preparing..." : "Set up MFA"}</Button> : <div className="mt-4 space-y-3"><p className="text-xs text-text-secondary">Add this secret to your authenticator app:</p><p className="rounded-md border border-border bg-surface-soft p-3 font-mono text-sm tracking-wider">{secret}</p><p className="break-all text-[11px] text-text-tertiary">{uri}</p><div className="flex gap-2"><input inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="min-w-0 flex-1 rounded-md border border-border px-3 py-2 text-sm" /><Button onClick={() => { void verify(); }} disabled={loading || code.length !== 6}>Verify</Button></div></div>}{message && <p className="mt-3 text-sm text-text-secondary">{message}</p>}</Panel>;
}
