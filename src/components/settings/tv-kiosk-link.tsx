"use client";

import { useState } from "react";
import { Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export function TvKioskLink() {
  const [url, setUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function issueUrl() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/tv-display/kiosk-token", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to issue kiosk URL.");
      setUrl(data.kioskUrl);
      setExpiresAt(data.expiresAt);
      setMessage("Kiosk URL issued. It expires automatically after 30 days.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to issue kiosk URL.");
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setMessage("Kiosk URL copied to the clipboard.");
  }

  return (
    <Panel className="mb-4 border-accent/30 bg-surface-soft p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Customer TV access</p>
          <h2 className="mt-1 text-base font-semibold text-text">Signed kiosk URL</h2>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">Create a store-specific link for a TV. It does not expose a staff session and expires after 30 days. Issue a new link to rotate access.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => { void issueUrl(); }} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {url ? "Rotate URL" : "Create kiosk URL"}
        </Button>
      </div>
      {url && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input readOnly value={url} aria-label="TV kiosk URL" className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs text-text" />
          <Button size="sm" variant="outline" onClick={() => { void copyUrl(); }}><Copy size={14} />Copy</Button>
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-text hover:bg-surface"><ExternalLink size={14} />Open</a>
        </div>
      )}
      {expiresAt && <p className="mt-2 text-xs text-text-tertiary">Expires {new Date(expiresAt).toLocaleString()}</p>}
      {message && <p role="status" className="mt-2 text-sm text-text-secondary">{message}</p>}
    </Panel>
  );
}
