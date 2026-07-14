import assert from "node:assert/strict";
import test from "node:test";
import { GameSyncService } from "@/lib/games-sync/game-sync-service";
import { InMemoryGameRepository } from "@/lib/games-sync/game-repository";
import { texasDrawSourceUrl } from "@/lib/games-sync/draw-game-parser";
import { texasScratchSourceUrl } from "@/lib/games-sync/scratch-game-parser";

const scratchFixture = `"Scratch-Off Prizes as of 07/13/2026"
"Game Number","Game Name","Game Close Date","Ticket Price","Prize Level","Total Prizes in Level","Prizes Claimed"
2753,"$1,000,000 Crossword",,20,"1000000","6","0"
2753,"$1,000,000 Crossword",,20,"TOTAL","100","40"
`;

const drawFixture = `
<html>
  <body>
    <h2>Drawing Schedule</h2>
    <div>Powerball - Monday, Wednesday, Saturday - 10:12 p.m. - sales cutoff 9:00 p.m.</div>
    <div>Mega Millions - Tuesday, Friday - 10:12 p.m. - sales cutoff 9:45 p.m.</div>
  </body>
</html>
`;

function buildFetchFixture() {
  return async function fetchFixture(url: string): Promise<Response> {
    if (url === texasScratchSourceUrl) {
      return new Response(scratchFixture, { status: 200 });
    }
    if (url === texasDrawSourceUrl) {
      return new Response(drawFixture, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  } as typeof fetch;
}

test("sync is idempotent for repeated runs", async () => {
  const repository = new InMemoryGameRepository();
  const service = new GameSyncService({
    repository,
    fetchImpl: buildFetchFixture(),
  });

  await service.syncStore("store-1");
  const firstCount = repository.getCatalogCount("store-1");

  await service.syncStore("store-1");
  const secondCount = repository.getCatalogCount("store-1");

  assert.equal(firstCount, secondCount);
});

