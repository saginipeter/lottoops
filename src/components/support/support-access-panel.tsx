"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { redeemSupportLink } from "@/lib/support-link";

interface AccessRequest {
  id: string;
  storeName: string;
  adminName: string;
  adminEmail: string;
  status: string;
  expiresAt: string | null;
}

export function SupportAccessPanel({ role }: { role: "OWNER" | "PLATFORM_ADMIN" }) {
  const router = useRouter();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharedLink, setSharedLink] = useState("");
  const [ownerLink, setOwnerLink] = useState("");
  const [copied, setCopied] = useState(false);
  const pendingLaunchToken = useRef<string | null>(null);
  const attemptedLaunchToken = useRef<string | null>(null);

  const redeem = useCallback(async (link: string) => {
    setBusy(true); setError("");
    try {
      await redeemSupportLink(link);
      setOwnerLink("");
      router.replace("/");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to enter support session.");
    } finally { setBusy(false); }
  }, [router]);

  async function load() {
    try {
      const response = await fetch("/api/support-access", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load access requests.");
      setRequests(data.requests ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load access requests.");
    }
  }

  useEffect(() => {
    if (role === "PLATFORM_ADMIN") {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const token = fragment.get("token") ?? fragment.get("support-token");
      if (token) {
        pendingLaunchToken.current = token;
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
    const timer = window.setTimeout(() => {
      void load();
      const token = pendingLaunchToken.current;
      if (role === "PLATFORM_ADMIN" && token && attemptedLaunchToken.current !== token) {
        attemptedLaunchToken.current = token;
        pendingLaunchToken.current = null;
        setOwnerLink(token);
        void redeem(token);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [role, redeem]);

  async function mutate(action: "approve" | "revoke", requestId: string) {
    if (action === "approve" && !window.confirm("Allow this requesting admin to access this store for 30 minutes? Generate a single-use link to share explicitly.")) return;
    setBusy(true); setError(""); setCopied(false);
    try {
      const response = await fetch("/api/support-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, requestId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update access request.");
      if (data.link) setSharedLink(data.link);
      else setSharedLink("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update access request.");
    } finally { setBusy(false); }
  }

  return (
    <Panel className="mb-4 p-5">
      <h3 className="font-semibold text-text">Store assistance access</h3>
      <p className="mt-1 text-sm text-text-secondary">{role === "OWNER"
        ? "Requests are delivered here in-app, not by email. Approve only an admin you expect, then copy and share the link directly with that admin. Links expire in 15 minutes; access lasts 30 minutes."
        : "Only the requesting admin can redeem an owner-shared link. Approval alone does not grant access; ask the owner to share their single-use link."}</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {role === "PLATFORM_ADMIN" && (
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void redeem(ownerLink); }}>
          <input aria-label="Owner-shared support link" value={ownerLink} onChange={(event) => setOwnerLink(event.target.value)} placeholder="Paste owner-shared support link" autoComplete="off" className="min-w-0 flex-1 rounded border border-border bg-bg px-3 py-2 text-sm" />
          <Button type="submit" size="sm" disabled={busy || !ownerLink.trim()}>Enter support session</Button>
        </form>
      )}
      {sharedLink && <div className="mt-3 space-y-2">
        <p className="text-sm text-text-secondary">Copy now: this link cannot be retrieved again. Share only with the requesting admin.</p>
        <input aria-label="Generated single-use support link" readOnly value={sharedLink} onFocus={(event) => event.target.select()} className="w-full rounded border border-border bg-bg px-3 py-2 text-sm" />
        <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(sharedLink).then(() => setCopied(true)).catch(() => setError("Clipboard unavailable. Select and copy the link above.")); }}>{copied ? "Copied" : "Copy link"}</Button>
      </div>}
      <div className="mt-4 space-y-2">
        {requests.length === 0 && <p className="text-sm text-text-secondary">No access requests.</p>}
        {requests.map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3">
          <div><p className="text-sm font-medium text-text">{request.storeName}</p><p className="text-xs text-text-secondary">{request.adminName} · {request.adminEmail} · {request.status}</p>{request.expiresAt && <p className="text-xs text-text-secondary">Link expiry: {new Date(request.expiresAt).toLocaleString()}</p>}</div>
          {role === "OWNER" && request.status !== "REVOKED" && <div className="flex gap-2">
            {request.status === "PENDING" && <Button size="sm" disabled={busy} onClick={() => { void mutate("approve", request.id); }}>Approve &amp; generate link</Button>}
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { void mutate("revoke", request.id); }}>{request.status === "PENDING" ? "Decline" : "Revoke access"}</Button>
          </div>}
        </div>)}
      </div>
      <Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={() => { void load(); }}>Refresh requests</Button>
    </Panel>
  );
}
