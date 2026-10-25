import type { PrismaClient } from "@prisma/client";

export const texasScratchArtworkCatalogUrl =
  "https://www.texaslottery.com/export/sites/lottery/Games/Scratch_Offs/index.html";
const IMAGE_BASE = "https://www.texaslottery.com/export/sites/lottery/Images/scratchoffs/";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;

export interface TexasArtworkIndexEntry {
  gameNumber: string;
  imageUrl: string;
}

export function normalizeTexasGameNumber(value: string): string | null {
  const number = value.trim();
  return /^\d{3,6}$/.test(number) ? number : null;
}

export function isOfficialTexasArtwork(value: string, gameNumber?: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "www.texaslottery.com" || url.port || url.username || url.password || url.search || url.hash) return false;
    const match = url.pathname.match(/^\/export\/sites\/lottery\/Images\/scratchoffs\/(\d{3,6})_(?:img1|200x200)\.(?:gif|png|jpe?g|webp)$/i);
    return Boolean(match && (gameNumber === undefined || match[1] === gameNumber));
  } catch {
    return false;
  }
}

/** Parse only explicitly published, game-specific images; never match a game by name. */
export function parseTexasArtworkIndex(html: string): Map<string, TexasArtworkIndexEntry> {
  const entries = new Map<string, TexasArtworkIndexEntry>();
  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = tag[0].match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!src) continue;
    let absolute: string;
    try { absolute = new URL(src.replace(/&amp;/g, "&"), texasScratchArtworkCatalogUrl).href; }
    catch { continue; }
    if (!isOfficialTexasArtwork(absolute)) continue;
    const gameNumber = new URL(absolute).pathname.match(/\/(\d{3,6})_/)![1];
    // The full front is preferred if a page publishes both a thumbnail and the front.
    const previous = entries.get(gameNumber);
    if (!previous || /_img1\./i.test(absolute)) entries.set(gameNumber, { gameNumber, imageUrl: absolute });
  }
  return entries;
}

export async function fetchTexasArtworkIndex(fetchImpl: typeof fetch = fetch): Promise<Map<string, TexasArtworkIndexEntry>> {
  const response = await fetchImpl(texasScratchArtworkCatalogUrl, {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Texas Lottery artwork catalog returned HTTP ${response.status}.`);
  if (Number(response.headers.get("content-length") ?? 0) > MAX_CATALOG_BYTES) throw new Error("Texas Lottery artwork catalog is unexpectedly large.");
  const html = await response.text();
  if (html.length > MAX_CATALOG_BYTES) throw new Error("Texas Lottery artwork catalog is unexpectedly large.");
  const entries = parseTexasArtworkIndex(html);
  if (entries.size === 0) throw new Error("Texas Lottery artwork catalog contained no game-specific ticket images.");
  return entries;
}

async function checkImage(url: string, fetchImpl: typeof fetch): Promise<"available" | "missing" | "unavailable"> {
  try {
    const response = await fetchImpl(url, {
      method: "HEAD", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404 || response.status === 410) return "missing";
    if (!response.ok || !/^image\/(gif|png|jpeg|webp)(?:;|$)/i.test(response.headers.get("content-type") ?? "")) return "unavailable";
    return "available";
  } catch {
    return "unavailable";
  }
}

/**
 * The official detail pages publish {gameNumber}_img1.gif as the ticket front.
 * Verify it before saving. null = definitely missing; undefined = temporary source failure.
 * An index thumbnail is used only when that exact game appears in the official index.
 */
export async function getTexasArtwork(
  gameNumber: string,
  fetchImpl: typeof fetch = fetch,
  indexedImage?: string,
): Promise<string | null | undefined> {
  const normalized = normalizeTexasGameNumber(gameNumber);
  if (!normalized) return null;
  const fullImage = `${IMAGE_BASE}${normalized}_img1.gif`;
  const fullResult = await checkImage(fullImage, fetchImpl);
  if (fullResult === "available") return fullImage;
  if (indexedImage && isOfficialTexasArtwork(indexedImage, normalized)) {
    const thumbnailResult = await checkImage(indexedImage, fetchImpl);
    if (thumbnailResult === "available") return indexedImage;
    if (thumbnailResult === "unavailable") return undefined;
  }
  return fullResult === "missing" ? null : undefined;
}

/** Store creation uses synced metadata first, then a verified official source lookup. */
export async function resolveGameArtwork(
  client: Pick<PrismaClient, "$queryRawUnsafe">,
  storeId: string,
  gameNumber: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const normalized = normalizeTexasGameNumber(gameNumber);
  if (!normalized) return null;
  try {
    const rows = await client.$queryRawUnsafe<Array<{ image_url: string | null }>>(
      `SELECT image_url FROM game_catalog WHERE store_id = $1 AND game_number = $2 AND game_type = 'scratch_off' LIMIT 1`,
      storeId, normalized,
    );
    const cached = rows[0]?.image_url;
    if (cached && isOfficialTexasArtwork(cached, normalized)) return cached;
  } catch (error) {
    // A new installation can create its first store game before its initial catalog sync.
    const code = (error as { meta?: { code?: string } }).meta?.code;
    if (code !== "42P01" && code !== "42703") throw error;
  }
  return (await getTexasArtwork(normalized, fetchImpl)) ?? null;
}
