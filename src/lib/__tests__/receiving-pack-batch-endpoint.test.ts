import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("batch receiving adds selected packs atomically with full barcodes and store-scoped data", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../prisma", "../permissions"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  let session: { userId: string; storeId: string; name: string; role: string } | null = {
    userId: "receiver", storeId: "store-a", name: "Receiver", role: "MANAGER",
  };
  const expectedPacks = 3;
  let existingPackCount = 0;
  let existingPacks: Array<{ serialNumber: string; shipmentId: string | null }> = [];
  const createdPacks: Array<Record<string, unknown>> = [];
  const createdGames: Array<Record<string, unknown>> = [];
  const lockedQueries: string[] = [];
  let transactionCount = 0;
  let gameNumberQuery: unknown;

  const tx = {
    $queryRawUnsafe: async (sql: string) => {
      lockedQueries.push(sql);
      if (sql.includes("FROM shipments")) return [{ id: "shipment-a", expectedPacks }];
      return [];
    },
    pack: {
      count: async () => existingPackCount,
      findMany: async () => existingPacks,
      create: async ({ data, include }: { data: Record<string, unknown>; include: Record<string, unknown> }) => {
        const game = createdGames.find((row) => row.gameNumber === data.gameNumber) ?? {
          id: `game-${String(data.gameNumber)}`,
          gameNumber: data.gameNumber,
          name: `Game ${String(data.gameNumber)}`,
          price: data.ticketPrice,
          ticketsPerPack: data.ticketQuantity,
        };
        const pack = { id: `saved-${createdPacks.length + 1}`, ...data, game };
        createdPacks.push(pack);
        assert.deepEqual(include, { game: true });
        return pack;
      },
    },
    game: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const game = { id: `game-${String(data.gameNumber)}`, ...data };
        createdGames.push(game);
        return game;
      },
    },
  };
  const fakePrisma = {
    game: {
      findMany: async ({ where }: { where: { storeId: string; gameNumber: { in: string[] } } }) => {
        gameNumberQuery = where;
        return createdGames.filter((game) => where.gameNumber.in.includes(String(game.gameNumber)));
      },
    },
    pack: {},
    $queryRawUnsafe: async () => [],
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>, options?: { isolationLevel: string }) => {
      transactionCount++;
      assert.equal(options?.isolationLevel, "Serializable");
      return callback(tx);
    },
  };
  require.cache[paths[0]] = { id: paths[0], filename: paths[0], loaded: true, exports: { getApiSession: async () => session } } as NodeJS.Module;
  require.cache[paths[1]] = { id: paths[1], filename: paths[1], loaded: true, exports: { prisma: fakePrisma } } as NodeJS.Module;
  require.cache[paths[2]] = { id: paths[2], filename: paths[2], loaded: true, exports: { canReceiveShipments: (value: typeof session) => value?.role === "MANAGER" } } as NodeJS.Module;
  context.after(() => paths.forEach((path, index) => {
    if (originals[index]) require.cache[path] = originals[index];
    else delete require.cache[path];
  }));

  const { POST } = await import("../../app/api/packs/batch/route");
  const packs = [
    { barcode: "24240089877", gameNumber: "2424", packNumber: "0089877", firstTicket: 1, ticketPrice: 10, ticketQuantity: 50 },
    { barcode: "24240089878", gameNumber: "2424", packNumber: "0089878", firstTicket: 1, ticketPrice: 10, ticketQuantity: 50 },
  ];
  const request = (body: unknown) => new NextRequest("http://localhost/api/packs/batch", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });

  const unauthorizedRole = { ...session!, role: "EMPLOYEE" };
  session = unauthorizedRole;
  assert.equal((await POST(request({ shipmentId: "shipment-a", packs }))).status, 403);
  assert.equal(transactionCount, 0, "unauthorized receiving never starts a write transaction");

  session = { ...unauthorizedRole, role: "MANAGER" };
  const invalid = await POST(request({ shipmentId: "shipment-a", packs: [packs[0], { ...packs[1], firstTicket: 51 }] }));
  assert.equal(invalid.status, 400, "every row is validated before any write begins");
  assert.equal(transactionCount, 0);

  const duplicate = await POST(request({ shipmentId: "shipment-a", packs: [packs[0], packs[0]] }));
  assert.equal(duplicate.status, 409, "duplicate barcode rows are rejected before writing");
  assert.equal(transactionCount, 0);

  const accepted = await POST(request({ shipmentId: "shipment-a", packs }));
  assert.equal(accepted.status, 201);
  const payload = await accepted.json();
  assert.equal(payload.success, true);
  assert.equal(payload.packs.length, 2);
  assert.deepEqual(payload.packs.map((pack: { serialNumber: string }) => pack.serialNumber), ["24240089877", "24240089878"]);
  assert.deepEqual(gameNumberQuery, { storeId: "store-a", gameNumber: { in: ["2424"] } });
  assert.equal(createdPacks.length, 2);
  assert.equal(createdGames.length, 1, "a shared game is created only once for the batch");
  assert.equal(createdPacks[0]?.storeId, "store-a");
  assert.equal(createdPacks[0]?.receivedById, "receiver");
  assert.equal(createdPacks[0]?.status, "RECEIVING");
  assert.equal(Number(createdPacks[0]?.cost), 475, "inventory cost remains 95% of ticket value");
  assert.ok(lockedQueries.some((sql) => sql.includes("FOR UPDATE")), "the shipment row is locked during the batch write");
  assert.equal(transactionCount, 1);

  existingPackCount = 2;
  const tooMany = await POST(request({ shipmentId: "shipment-a", packs: [
    { ...packs[0], barcode: "24240089879", packNumber: "0089879" },
    { ...packs[1], barcode: "24240089880", packNumber: "0089880" },
  ] }));
  assert.equal(tooMany.status, 409, "a batch cannot exceed the shipment's expected pack count");

  existingPacks = [{ serialNumber: packs[0].barcode, shipmentId: "other-shipment" }];
  const alreadyExists = await POST(request({ shipmentId: "shipment-a", packs: [packs[0]] }));
  assert.equal(alreadyExists.status, 409, "a pack already associated with another shipment is rejected");
});
