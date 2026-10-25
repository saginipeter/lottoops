import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";
import { PrismaGameRepository } from "@/lib/games-sync/game-repository";
import type { ClassifiedGame } from "@/lib/games-sync/types";

const image = "https://www.texaslottery.com/export/sites/lottery/Images/scratchoffs/2753_200X200.gif";
const oldFrontImage = "https://www.texaslottery.com/export/sites/lottery/Images/scratchoffs/2753_img1.gif";

test("repository preserves undefined artwork, clears confirmed missing art, and updates only the exact existing store game", async () => {
  const queries: unknown[][] = [];
  const writes: any[] = [];
  const client = {
    async $executeRawUnsafe(...args: unknown[]) { queries.push(args); return 1; },
    game: { async updateMany(args: unknown) { writes.push(args); return { count: 1 }; } },
  };
  const repository = new PrismaGameRepository(client);
  const game: ClassifiedGame = { externalId: "scratch:2753", name: "Crossword", sourceUrl: "https://www.texaslottery.com/", sourceType: "scratch_offs", gameNumber: "2753", gameType: "scratch_off", status: "active", price: 20 };
  await repository.upsertGame("store-1", { ...game, imageUrl: image });
  assert.match(String(queries[0][0]), /image_url\s*= CASE WHEN \$26::boolean/);
  assert.equal(queries[0][13], image);
  assert.equal(queries[0][26], true);
  assert.deepEqual(writes[0], { where: { storeId: "store-1", gameNumber: "2753" }, data: { imageUrl: image } });
  await repository.upsertGame("store-1", game);
  assert.equal(queries[1][26], false);
  assert.equal(writes.length, 1);
  await repository.upsertGame("store-1", { ...game, imageUrl: null });
  assert.equal(queries[2][26], true);
  assert.deepEqual(writes[1].data, { imageUrl: null });
  await repository.upsertGame("store-2", { ...game, gameType: "draw_game", sourceType: "drawing_schedule", imageUrl: image });
  assert.equal(writes.length, 2);
});

test("Games and catalog handlers import official artwork without accepting manual image URLs or crossing stores", async context => {
  const require = createRequire(import.meta.url);
  const sessionPath = require.resolve("../api-session");
  const prismaPath = require.resolve("../prisma");
  const originalSession = require.cache[sessionPath];
  const originalPrisma = require.cache[prismaPath];
  let session: any = { userId: "manager", storeId: "store-1", name: "Manager", role: "MANAGER" };
  let existing: any = { id: "game", storeId: "store-1", gameNumber: "2753" };
  let catalogImage: string | null = image;
  const created: any[] = [];
  const updated: any[] = [];
  const queries: unknown[][] = [];
  const fakePrisma = {
    game: {
      async findUnique() { return existing; },
      async findFirst() { return null; },
      async findMany() { return []; },
      async create({ data }: any) { created.push(data); return { id: "new-game", ...data }; },
      async createMany({ data }: any) { created.push(...data); return { count: data.length }; },
      async update({ data }: any) { updated.push(data); return { ...existing, ...data, price: 20 }; },
    },
    async $queryRawUnsafe(sql: string, ...params: unknown[]) {
      queries.push([sql, ...params]);
      assert.equal(params[0], "store-1");
      if (sql.includes("SELECT image_url")) return [{ image_url: image }];
      if (sql.includes('AS "gameNumber"')) return [{ gameNumber: "2753", name: "Crossword", ticketPrice: 20, imageUrl: image }];
      return [{ id: "entry", external_key: "scratch:2753", game_number: "2753", game_type: "scratch_off", name: "Crossword", ticket_price: 20, image_url: catalogImage, last_synced_at: "2026-10-25" }];
    },
  };
  require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: { getApiSession: async () => session } } as any;
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma: fakePrisma } } as any;
  try {
    const games = await import("../../app/api/games/route");
    const catalog = await import("../../app/api/games/catalog/route");
    const request = (path: string, method: string, body?: object) => new NextRequest(`https://lottoops.test${path}`, { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
    const valid = { gameNumber: "2753", name: "Crossword", price: 20, ticketsPerPack: 25 };

    await context.test("manual URLs are rejected before any database writes", async () => {
      const post = await games.POST(request("/api/games", "POST", { ...valid, imageUrl: "https://uploads.example/manual.png" }));
      assert.equal(post.status, 400);
      assert.match((await post.json()).error, /automatically/);
      const patch = await games.PATCH(request("/api/games", "PATCH", { id: "game", imageUrl: null }));
      assert.equal(patch.status, 400);
      assert.equal(created.length + updated.length, 0);
    });
    await context.test("game creation saves the exact official cached image", async () => {
      const response = await games.POST(request("/api/games", "POST", valid));
      assert.equal(response.status, 200);
      assert.equal(created[0].imageUrl, image);
      assert.equal(created[0].storeId, "store-1");
    });
    await context.test("active-only updates do not look up or replace artwork", async () => {
      const before = queries.length;
      assert.equal((await games.PATCH(request("/api/games", "PATCH", { id: "game", active: false }))).status, 200);
      assert.equal(queries.length, before);
      assert.deepEqual(updated[0], { active: false });
    });
    await context.test("another store's game cannot be edited", async () => {
      existing = { ...existing, storeId: "store-2" };
      assert.equal((await games.PATCH(request("/api/games", "PATCH", { id: "game", active: true }))).status, 404);
      existing = { ...existing, storeId: "store-1" };
    });
    await context.test("catalog GET exposes official artwork and single add copies it", async () => {
      const result = await catalog.GET(request("/api/games/catalog", "GET"));
      assert.equal(result.status, 200);
      assert.equal((await result.json()).catalog[0].imageUrl, image);
      const response = await catalog.POST(request("/api/games/catalog", "POST", { externalKey: "scratch:2753" }));
      assert.equal(response.status, 200);
      assert.equal(created.at(-1).imageUrl, image);
    });
    await context.test("catalog hides full ticket fronts and missing artwork", async () => {
      catalogImage = oldFrontImage;
      const frontResult = await catalog.GET(request("/api/games/catalog", "GET"));
      assert.equal(frontResult.status, 200);
      assert.equal((await frontResult.json()).catalog[0].imageUrl, null);

      const frontAdd = await catalog.POST(request("/api/games/catalog", "POST", { externalKey: "scratch:2753" }));
      assert.equal(frontAdd.status, 200);
      assert.equal(created.at(-1).imageUrl, null);

      catalogImage = null;
      const missingResult = await catalog.GET(request("/api/games/catalog", "GET"));
      assert.equal(missingResult.status, 200);
      assert.equal((await missingResult.json()).catalog[0].imageUrl, null);

      const missingAdd = await catalog.POST(request("/api/games/catalog", "POST", { externalKey: "scratch:2753" }));
      assert.equal(missingAdd.status, 200);
      assert.equal(created.at(-1).imageUrl, null);

      catalogImage = image;
    });
    await context.test("bulk catalog add includes artwork", async () => {
      const response = await catalog.POST(request("/api/games/catalog", "POST", { action: "add-all" }));
      assert.equal(response.status, 200);
      assert.equal(created.at(-1).imageUrl, image);
    });
    await context.test("employees and auditors cannot replace Games metadata", async () => {
      for (const role of ["EMPLOYEE", "AUDITOR", "PLATFORM_ADMIN"]) {
        session = { ...session, role };
        assert.equal((await games.POST(request("/api/games", "POST", valid))).status, 403);
        assert.equal((await games.PATCH(request("/api/games", "PATCH", { id: "game", active: false }))).status, 403);
        assert.equal((await catalog.POST(request("/api/games/catalog", "POST", { externalKey: "scratch:2753" }))).status, 403);
      }
    });
  } finally {
    if (originalSession) require.cache[sessionPath] = originalSession; else delete require.cache[sessionPath];
    if (originalPrisma) require.cache[prismaPath] = originalPrisma; else delete require.cache[prismaPath];
  }
});
