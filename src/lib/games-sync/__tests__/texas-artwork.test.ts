import assert from "node:assert/strict";
import test from "node:test";
import { parseTexasArtworkIndex, getTexasArtwork, isOfficialTexasArtwork, fetchTexasArtworkIndex, resolveGameArtwork, texasScratchArtworkCatalogUrl } from "@/lib/games-sync/texas-artwork";
import { GameSyncService } from "@/lib/games-sync/game-sync-service";
import { texasScratchSourceUrl } from "@/lib/games-sync/scratch-game-parser";
import { texasDrawSourceUrl } from "@/lib/games-sync/draw-game-parser";
import type { ClassifiedGame, SyncRunSummary } from "@/lib/games-sync/types";
import type { GameRepository } from "@/lib/games-sync/game-repository";

const base = "https://www.texaslottery.com/export/sites/lottery/Images/scratchoffs/";
const index = `<h3>Featured Tickets</h3><a href="details.html"><img src="/export/sites/lottery/Images/scratchoffs/2753_200X200.gif" alt="Crossword"></a>
<h3>New Tickets</h3><img src='${base}2769_200X200.gif' alt='Lucky 7 Doubler'>`;
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

test("official index maps promotional images by exact game number and rejects fronts, backs, logos and third parties", () => {
  const entries = parseTexasArtworkIndex(index + `
    <img src="https://evil.example/2753_200X200.gif">
    <img src="${base}2753_img1.gif">
    <img src="${base}2753_img2.gif">
    <img src="${base}scratch_price_20.png">
    <img src="javascript:alert(1)">
    <img src="https://www.texaslottery.com@evil.example/export/sites/lottery/Images/scratchoffs/2753_200X200.gif">`);
  assert.equal(entries.size, 2);
  assert.equal(entries.get("2753")?.imageUrl, `${base}2753_200X200.gif`);
  assert.equal(entries.get("2769")?.imageUrl, `${base}2769_200X200.gif`);
  assert.equal(isOfficialTexasArtwork(`${base}2753_200X200.gif`, "2769"), false);
  assert.equal(isOfficialTexasArtwork(`${base}2753_200X200.gif?redirect=bad`), false);
  assert.equal(isOfficialTexasArtwork(`${base}2753_img1.gif`), false);
});

test("ticket fronts can never override the exact promotional image on the index", () => {
  assert.equal(parseTexasArtworkIndex(index + `<img src="${base}2753_img1.gif">`).get("2753")?.imageUrl, `${base}2753_200X200.gif`);
});

test("promotional artwork is verified with HEAD and correct MIME; no ticket-front URL is requested", async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const fetcher = (async (url, init) => { calls.push({ url: String(url), method: init?.method }); return imageResponse(); }) as typeof fetch;
  assert.equal(await getTexasArtwork("2753", fetcher, `${base}2753_200X200.gif`), `${base}2753_200X200.gif`);
  assert.deepEqual(calls, [{ url: `${base}2753_200X200.gif`, method: "HEAD" }]);
});

test("missing promotional artwork never falls back to a front or another game's image", async () => {
  const calls: string[] = [];
  const fetcher = (async url => { calls.push(String(url)); return imageResponse(404); }) as typeof fetch;
  assert.equal(await getTexasArtwork("2753", fetcher, `${base}2753_200X200.gif`), null);
  assert.equal(await getTexasArtwork("2753", fetcher, `${base}2769_200X200.gif`), null);
  assert.equal(await getTexasArtwork("2753", fetcher, `${base}2753_img1.gif`), null);
  assert.deepEqual(calls, [`${base}2753_200X200.gif`]);
});

test("a game absent from the successful shared index has no image and causes no guessed URL requests", async () => {
  let calls = 0;
  assert.equal(await getTexasArtwork("2424", (async () => { calls++; return imageResponse(); }) as typeof fetch, null), null);
  assert.equal(calls, 0);
});

test("individual game creation looks up the selected official page and verifies only its published image", async () => {
  const calls: string[] = [];
  const fetcher = (async url => { calls.push(String(url)); return url === texasScratchArtworkCatalogUrl ? new Response(index) : imageResponse(); }) as typeof fetch;
  assert.equal(await getTexasArtwork("2753", fetcher), `${base}2753_200X200.gif`);
  assert.deepEqual(calls, [texasScratchArtworkCatalogUrl, `${base}2753_200X200.gif`]);
  calls.length = 0;
  assert.equal(await getTexasArtwork("2424", fetcher), null);
  assert.deepEqual(calls, [texasScratchArtworkCatalogUrl]);
});

test("404/410 mean missing; outages, wrong MIME and timeouts mean unavailable", async () => {
  const image = `${base}2753_200X200.gif`;
  for (const status of [404, 410]) assert.equal(await getTexasArtwork("2753", (async () => imageResponse(status)) as typeof fetch, image), null);
  assert.equal(await getTexasArtwork("2753", (async () => imageResponse(503)) as typeof fetch, image), undefined);
  assert.equal(await getTexasArtwork("2753", (async () => imageResponse(200, "text/html")) as typeof fetch, image), undefined);
  assert.equal(await getTexasArtwork("2753", (async () => { throw new Error("timeout"); }) as typeof fetch, image), undefined);
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

test("sync stores each game's own promotional artwork and remains idempotent across stores", async () => {
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
  assert.equal(records.get("store-1:scratch:2753")?.imageUrl, `${base}2753_200X200.gif`);
  assert.equal(records.get("store-1:scratch:2769")?.imageUrl, `${base}2769_200X200.gif`);
  await service.syncStore("store-1");
  assert.equal(records.size, 2);
  await service.syncStore("store-2");
  assert.equal(records.size, 4);
});

test("partial image failures preserve verified promotional URLs but confirmed missing artwork is cleared", async () => {
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
  assert.equal(records.get("store-1:scratch:2753")?.imageUrl, `${base}2753_200X200.gif`);
  assert.equal(records.get("store-1:scratch:2769")?.imageUrl, null);
  assert.equal(summary.artworkMissing, 1);
  assert.equal(summary.artworkUnavailable, 1);
  assert.ok(summary.sourceFailures.some(failure => failure.error.includes("previously verified")));
});

test("catalog outages preserve prior data and do not repeatedly fetch the failed index or request ticket fronts", async () => {
  const { repository, records } = memoryRepository();
  let failing = false;
  let indexCalls = 0;
  let imageCalls = 0;
  const fetcher = (async url => {
    if (url === texasScratchSourceUrl) return new Response(csv);
    if (url === texasDrawSourceUrl) return new Response("<h2>Drawing Schedule</h2>");
    if (url === texasScratchArtworkCatalogUrl) { indexCalls++; return new Response(index, { status: failing ? 503 : 200 }); }
    imageCalls++;
    return imageResponse();
  }) as typeof fetch;
  const service = new GameSyncService({ repository, fetchImpl: fetcher });
  await service.syncStore("store-1");
  failing = true;
  const beforeImages = imageCalls;
  const summary = await service.syncStore("store-1");
  assert.equal(indexCalls, 2);
  assert.equal(imageCalls, beforeImages);
  assert.equal(summary.artworkUnavailable, 2);
  assert.equal(records.get("store-1:scratch:2753")?.imageUrl, `${base}2753_200X200.gif`);
});

test("sync limits promotional artwork network concurrency to six requests", async () => {
  const { repository } = memoryRepository();
  let active = 0;
  let peak = 0;
  const many = csv.split("\n").slice(0, 2).join("\n") + "\n" + Array.from({ length: 19 }, (_, i) => `${3000 + i},"Game ${i}",,5,TOTAL,100,0`).join("\n");
  const manyImages = Array.from({ length: 19 }, (_, i) => `<img src="${base}${3000 + i}_200X200.gif">`).join("");
  const fetcher = (async url => {
    if (url === texasScratchSourceUrl) return new Response(many);
    if (url === texasDrawSourceUrl) return new Response("<h2>Drawing Schedule</h2>");
    if (url === texasScratchArtworkCatalogUrl) return new Response(manyImages);
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active--;
    return imageResponse();
  }) as typeof fetch;
  await new GameSyncService({ repository, fetchImpl: fetcher }).syncStore("store-1");
  assert.ok(peak > 1 && peak <= 6);
});

test("game creation uses only store-scoped, number-matched cached promotional artwork", async () => {
  const queries: unknown[][] = [];
  const client = { async $queryRawUnsafe(...args: unknown[]) { queries.push(args); return [{ image_url: `${base}2753_200X200.gif` }]; } } as any;
  const neverFetch = (async () => { throw new Error("should use cache"); }) as typeof fetch;
  assert.equal(await resolveGameArtwork(client, "store-1", "2753", neverFetch), `${base}2753_200X200.gif`);
  assert.deepEqual(queries[0].slice(1), ["store-1", "2753"]);
  assert.equal(await resolveGameArtwork(client, "store-1", "2769", (async url => url === texasScratchArtworkCatalogUrl ? new Response(index) : imageResponse(404)) as typeof fetch), null);
});

test("previously cached full ticket fronts are replaced with index promotional images", async () => {
  const client = { async $queryRawUnsafe() { return [{ image_url: `${base}2753_img1.gif` }]; } } as any;
  const fetcher = (async url => url === texasScratchArtworkCatalogUrl ? new Response(index) : imageResponse()) as typeof fetch;
  assert.equal(await resolveGameArtwork(client, "store-1", "2753", fetcher), `${base}2753_200X200.gif`);
});
