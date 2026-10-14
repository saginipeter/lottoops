export function getSupportLinkToken(link: string): string | null {
  const value = link.trim();
  if (/^[a-f0-9]{64}$/.test(value)) return value;
  try {
    const fragment = new URLSearchParams(new URL(value).hash.slice(1));
    const token = fragment.get("token") ?? fragment.get("support-token");
    return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}

export async function redeemSupportLink(link: string, fetcher: typeof fetch = fetch) {
  const token = getSupportLinkToken(link);
  if (!token) throw new Error("Paste the complete owner-shared link.");
  const response = await fetcher("/api/platform/impersonate", {
    method: "POST",
    credentials: "same-origin",
    referrerPolicy: "no-referrer",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to enter support session.");
}
