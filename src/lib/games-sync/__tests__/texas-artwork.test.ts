import assert from "node:assert/strict";
import test from "node:test";
import { parseTexasArtworkIndex, getTexasArtwork, isOfficialTexasArtwork, fetchTexasArtworkIndex, resolveGameArtwork, texasScratchArtworkCatalogUrl } from "@/lib/games-sync/texas-artwork";
import { GameSyncService } from "@/lib/games-sync/game-sync-service";
import { texasScratchSourceUrl } from "@/lib/games-sync/scratch-game-parser";
import { texasDrawSourceUrl } from "@/lib/games-sync/draw-game-parser";
import type { ClassifiedGame, SyncRunSummary } from "@/lib/games-sync/types";
import type { GameRepository } from "@/lib/games-sync/game-repository";

const base = "https://www.texaslottery.com/export/sites/lottery/Images/scratchoffs/";
const index = `<a href="details.html"><img src="/export/sites/lottery/Images/scratchoffs/2753_200X200.gif" alt="Crossword"></a>
<img src='${base}2769_200X200.gif' alt='Lucky 7 Doubler'>`;
const csv = `"Scratch-Off Prizes as of 10/23/2026"
"Game Number","Game Name","Game Close Date","Ticket Price","Prize Level","Total Prizes in Level","Prizes Claimed"
2753,"Crossword",,20,"TOTAL",100,40
2769,"Lucky 7 Doubler",,10,"TOTAL",100,20
`;

function imageResponse(status = 200, type = "image/gif") {
  return new Response(null, { status, headers: { "content-type": type } });
}

function memoryRepository() {
  const records = new Map<string, ClassifiedGame>();
  const logs: SyncRunSummary[] = [];
  const repository: GameRepository = {
    async ensureSchema() {},
    async upsertGame(storeId, game) {
      const key = `${storeId}:${game.externalId}`;
      const old = records.get(key);
      records.set(key, { ...game, imageUrl: game.imageUrl === undefined ? old?.imageUrl : game.imageUrl });
    },
    async enqueueManualReview() {},
    async writeSyncLog(summary) { logs.push(summary); },
  };
  return { repository, records, logs };
}

test("official index maps images by exact game number and rejects logos, backs, third parties and malformed URLs", () => {
  const entries = parseTexasArtworkIndex(index + `
    <img src="https://evil.example/2753_img1.gif">
    <img src="${base}2753_img2.gif">
    <img src="${base}scratch_price_20.png">
    <img src="javascript:alert(1)">
    <img src="https://www.texaslottery.com@evil.example/export/sites/lottery/Images/scratchoffs/2753_img1.gif">`);
  assert.equal(entries.size, 2);
  assert.equal(entries.get("2753")?.imageUrl, `${base}2753_200X200.gif`);
  assert.equal(entries.get("2769")?.imageUrl, `${base}2769_200X200.gif`);
  assert.equal(isOfficialTexasArtwork(`${base}2753_img1.gif`, "2769"), false);
  assert.equal(isOfficialTexasArtwork(`${base}2753_img1.gif?redirect=bad`), false);
});

test("published full-front images win over thumbnails for the same game", () => {
  assert.equal(parseTexasArtworkIndex(index + `<img src="${base}2753_img1.gif">`).get("2753")?.imageUrl, `${base}2753_img1.gif`);
});

test("full ticket front is verified with HEAD and correct MIME before being stored", async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const fetcher = (async (url, init) => { calls.push({ url: String(url), method: init?.method }); return imageResponse(); }) as typeof fetch;
  assert.equal(await getTexasArtwork("2753", fetcher), `${base}2753_img1.gif`);
  assert.deepEqual(calls, [{ url: `${base}2753_img1.gif`, method: "HEAD" }]);
});

test("missing full fronts use only the verified thumbnail for that exact game", async () => {
  const fetcher = (async url => String(url).includes("_img1.") ? imageResponse(404) : imageResponse()) as typeof fetch;
  assert.equal(await getTexasArtwork("2753", fetcher, `${base}2753_200X200.gif`), `${base}2753_200X200.gif`);
  assert.equal(await getTexasArtwork("2753", fetcher, `${base}2769_200X200.gif`), null);
});

test("404/410 mean missing; outages, wrong MIME and timeouts mean unavailable and do not replace verified art", async () => {
  for (const status of [404, 410]) assert.equal(await getTexasArtwork("2753", (async () => imageResponse(status)) as typeof fetch), null);
  assert.equal(await getTexasArtwork("2753", (async () => imageResponse(503)) as typeof fetch), undefined);
  assert.equal(await getTexasArtwork("2753", (async () => imageResponse(200, "text/html")) as typeof fetch), undefined);
  assert.equal(await getTexasArtwork("2753", (async () => { throw new Error("timeout"); }) as typeof fetch), undefined);
});

test("invalid game numbers never initiate external network requests", async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; return imageResponse(); }) as typeof fetch;
  for (const value of ["../../secret", "2753?test=1", "abc", "1", "https://evil.example"]) assert.equal(await getTexasArtwork(value, fetcher), null);
  assert.equal(calls, 0);
});

test("empty or failed official artwork catalogs report failure instead of inventing mappings", async () => {
  await assert.rejects(fetchTexasArtworkIndex((async () => new Response("<img src='/logo.png'>")) as typeof fetch), /no game-specific/);
  await assert.rejects(fetchTexasArtworkIndex((async () => new Response("error", { status: 503 })) as typeof fetch), /503/);
});

test("sync stores each game's own official artwork and remains idempotent across stores", async () => {
  const { repository, records } = memoryRepository();
  const fetcher = (async url => {
    if (url === texasScratchSourceUrl) return new Response(csv);
    if (url === texasDrawSourceUrl) return new Response("<h2>Drawing Schedule</h2>");
    if (url === texasScratchArtworkCatalogUrl) return new Response(index);
    return imageResponse();
  }) as typeof fetch;
  const service = new GameSyncService({ repository, fetchImpl: fetcher });
  const first = await service.syncStore("store-1");
  assert.equal(first.artworkFound, 2);
  assert.equal(first.sourceFailures.length, 0);
  assert.equal(records.get("store-1:scratch:2753")?.imageUrl, `${base}2753_img1.gif`);
  assert.equal(records.get("store-1:scratch:2769")?.imageUrl, `${base}2769_img1.gif`);
  await service.syncStore("store-1");
  assert.equal(records.size, 2);
  await service.syncStore("store-2");
  assert.equal(records.size, 4);
});

test("partial artwork failures preserve old URLs but confirmed missing artwork is cleared", async () => {
  const { repository, records } = memoryRepository();
  let failing = false;
  const fetcher = (async url => {
    if (url === texasScratchSourceUrl) return new Response(csv);
    if (url === texasDrawSourceUrl) return new Response("<h2>Drawing Schedule</h2>");
    if (url === texasScratchArtworkCatalogUrl) return new Response(index);
    if (failing) return imageResponse(String(url).includes("2753") ? 503 : 404);
    return imageResponse();
  }) as typeof fetch;
  const service = new GameSyncService({ repository, fetchImpl: fetcher });
  await service.syncStore("store-1");
  failing = true;
  const summary = await service.syncStore("store-1");
  assert.equal(records.get("store-1:scratch:2753")?.imageUrl, `${base}2753_img1.gif`);
  assert.equal(records.get("store-1:scratch:2769")?.imageUrl, null);
  assert.equal(summary.artworkMissing, 1);
  assert.equal(summary.artworkUnavailable, 1);
  assert.ok(summary.sourceFailures.some(failure => failure.error.includes("previously verified")));
});

test("sync limits artwork network concurrency to six requests", async () => {
  const { repository } = memoryRepository();
  let active = 0;
  let peak = 0;
  const many = csv.split("\n").slice(0, 2).join("\n") + "\n" + Array.from({ length: 19 }, (_, i) => `${3000 + i},"Game ${i}",,5,TOTAL,100,0`).join("\n");
  const fetcher = (async url => {
    if (url === texasScratchSourceUrl) return new Response(many);
    if (url === texasDrawSourceUrl) return new Response("<h2>Drawing Schedule</h2>");
    if (url === texasScratchArtworkCatalogUrl) return new Response(index);
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active--;
    return imageResponse();
  }) as typeof fetch;
  await new GameSyncService({ repository, fetchImpl: fetcher }).syncStore("store-1");
  assert.ok(peak > 1 && peak <= 6);
});

test("game creation uses only store-scoped, number-matched official cached artwork", async () => {
  const queries: unknown[][] = [];
  const client = { async $queryRawUnsafe(...args: unknown[]) { queries.push(args); return [{ image_url: `${base}2753_img1.gif` }]; } } as any;
  const neverFetch = (async () => { throw new Error("should use cache"); }) as typeof fetch;
  assert.equal(await resolveGameArtwork(client, "store-1", "2753", neverFetch), `${base}2753_img1.gif`);
  assert.deepEqual(queries[0].slice(1), ["store-1", "2753"]);
  assert.equal(await resolveGameArtwork(client, "store-1", "2769", (async () => imageResponse(404)) as typeof fetch), null);
});
