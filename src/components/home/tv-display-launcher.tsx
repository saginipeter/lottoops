"use client";

import { useState } from "react";
import { Loader2, Tv } from "lucide-react";
import { decodeJwt } from "jose";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export type TvStore = { id: string; name: string };

export function getTvTarget(stores: TvStore[], currentStoreId?: string): TvStore | undefined {
  return currentStoreId ? stores.find((store) => store.id === currentStoreId) : undefined;
}

type KioskWindow = { opener: unknown; location: { href: string }; closed: boolean; close: () => void };

export async function launchTvWindow(
  storeId: string,
  openWindow: () => KioskWindow | null,
  request: typeof fetch = fetch,
): Promise<void> {
  // Reserve the window before awaiting the token so popup blockers see the user click.
  const popup = openWindow();
  if (!popup) throw new Error("Allow popups for LottoOps to open the TV Display Board.");
  popup.opener = null;
  try {
    const response = await request("/api/tv-display/kiosk-token", {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Unable to open the TV Display Board.");
    if (typeof data.kioskUrl !== "string") throw new Error("The TV kiosk link is unavailable.");
    const url = new URL(data.kioskUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/tv-display" || !url.searchParams.get("token")) {
      throw new Error("The TV kiosk link is invalid.");
    }
    // The TV page verifies the signature; this check prevents opening a different store after a session change.
    const payload = decodeJwt(url.searchParams.get("token")!);
    if (payload.type !== "TV_KIOSK" || payload.storeId !== storeId) {
      throw new Error("The TV link does not match your current store. Refresh the dashboard and try again.");
    }
    if (popup.closed) throw new Error("The TV window was closed. Try opening it again.");
    popup.location.href = url.href;
  } catch (error) {
    popup.close();
    throw error;
  }
}

export function TvDisplayLauncher({ stores, currentStoreId, loading = false }: {
  stores: TvStore[]; currentStoreId?: string; loading?: boolean;
}) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const target = getTvTarget(stores, currentStoreId);

  async function openBoard() {
    if (!target || opening) return;
    setOpening(true);
    setError("");
    try {
      await launchTvWindow(target.id, () => window.open("about:blank", "_blank"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open the TV Display Board.");
    } finally {
      setOpening(false);
    }
  }

  return <Panel className="mb-5 border-2 border-accent/40 bg-surface p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Tv size={30} className="shrink-0 text-accent" />
        <div><h2 className="text-lg font-bold text-text">TV Display Board</h2><p className="mt-1 text-sm text-text-secondary">Open the live customer display in a separate TV window{target ? ` for ${target.name}` : ""}.</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {target && <span className="text-sm font-semibold text-text">Current store: {target.name}</span>}
        <Button onClick={() => { void openBoard(); }} disabled={loading || opening || !target}>
          {opening ? <Loader2 size={17} className="animate-spin" /> : <Tv size={17} />}
          {opening ? "Opening TV…" : "Open TV Display Board"}
        </Button>
      </div>
    </div>
    {!loading && !target && <p className="mt-3 text-sm text-text-secondary">{stores.length > 0 ? "Your current store is not an accessible owned store. Sign in to the intended store before opening its TV display." : "No accessible stores are available for a TV display."}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </Panel>;
}
