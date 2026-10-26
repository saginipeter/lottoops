import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

const PNG_HEADER = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const OFFICIAL_IMAGE = "https://www.texaslottery.com/export/sites/lottery/Images/scratchoffs/2753_200X200.gif";

test("game artwork upload validates the image, scopes the game, and saves the Blob URL", async () => {
  const require = createRequire(import.meta.url);
  const sessionPath = require.resolve("../api-session");
  const prismaPath = require.resolve("../prisma");
  const blobPath = require.resolve("@vercel/blob");
  const originalSession = require.cache[sessionPath];
  const originalPrisma = require.cache[prismaPath];
  const originalBlob = require.cache[blobPath];
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  const uploaded: unknown[] = [];
  const updates: unknown[] = [];
  let session: any = { userId: "manager", storeId: "store-1", role: "MANAGER" };
  const fakePrisma = {
    game: {
      async findFirst() { return { id: "game-1", name: "Crossword", gameNumber: "2753" }; },
      async update({ data }: any) {
        updates.push(data);
        return { id: "game-1", imageUrl: data.imageUrl, updatedAt: new Date("2026-10-26T12:00:00Z") };
      },
    },
    async $queryRawUnsafe() { return [{ image_url: OFFICIAL_IMAGE }]; },
  };

  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: { getApiSession: async () => session },
  } as any;
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: { prisma: fakePrisma },
  } as any;
  require.cache[blobPath] = {
    id: blobPath,
    filename: blobPath,
    loaded: true,
    exports: {
      put: async (...args: unknown[]) => {
        uploaded.push(args);
        return { url: "https://store-1.public.blob.vercel-storage.com/custom-artwork.png" };
      },
    },
  } as any;
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";

  try {
    const artwork = await import("../../app/api/games/[id]/artwork/route");
    const request = (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return new NextRequest("https://lottoops.test/api/games/game-1/artwork", { method: "POST", body: form });
    };

    const validResponse = await artwork.POST(
      request(new File([PNG_HEADER], "custom.png", { type: "image/png" })),
      { params: Promise.resolve({ id: "game-1" }) },
    );
    assert.equal(validResponse.status, 200);
    assert.equal((await validResponse.json()).game.imageUrl, "https://store-1.public.blob.vercel-storage.com/custom-artwork.png");
    assert.equal(uploaded.length, 1);
    assert.match(String((uploaded[0] as unknown[])[0]), /^stores\/store-1\/games\/game-1\/artwork\//);
    assert.deepEqual(updates, [{ imageUrl: "https://store-1.public.blob.vercel-storage.com/custom-artwork.png" }]);

    const restoredResponse = await artwork.DELETE(
      new NextRequest("https://lottoops.test/api/games/game-1/artwork", { method: "DELETE" }),
      { params: Promise.resolve({ id: "game-1" }) },
    );
    assert.equal(restoredResponse.status, 200);
    assert.equal((await restoredResponse.json()).game.imageUrl, OFFICIAL_IMAGE);
    assert.deepEqual(updates.at(-1), { imageUrl: OFFICIAL_IMAGE });

    const invalidResponse = await artwork.POST(
      request(new File([Buffer.from("not-an-image")], "custom.png", { type: "image/png" })),
      { params: Promise.resolve({ id: "game-1" }) },
    );
    assert.equal(invalidResponse.status, 415);
    assert.equal(uploaded.length, 1);

    session = { ...session, role: "EMPLOYEE" };
    const forbiddenResponse = await artwork.POST(
      request(new File([PNG_HEADER], "custom.png", { type: "image/png" })),
      { params: Promise.resolve({ id: "game-1" }) },
    );
    assert.equal(forbiddenResponse.status, 403);
  } finally {
    if (originalSession) require.cache[sessionPath] = originalSession; else delete require.cache[sessionPath];
    if (originalPrisma) require.cache[prismaPath] = originalPrisma; else delete require.cache[prismaPath];
    if (originalBlob) require.cache[blobPath] = originalBlob; else delete require.cache[blobPath];
    if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  }
});
