import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";
import { verifyTvKioskToken } from "@/lib/tv-kiosk";

test("TV kiosk links preserve store scope while selecting a physical screen", async (context) => {
  process.env.JWT_SECRET = "tv-screen-links-test-secret-that-is-long-enough";
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../prisma", "../permissions", "../plan-access"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  let session: any = null;
  const stores: Array<{ id: string; name: string }> = [{ id: "store-a", name: "Store A" }];
  const fakePrisma = {
    store: {
      async findFirst({ where }: { where: { id: string } }) {
        assert.equal(where.id, session?.storeId, "the route must always use the signed-in store");
        return stores.find((store) => store.id === where.id) ?? null;
      },
    },
  };
  paths.forEach((path, index) => {
    const exports = [
      { getApiSession: async () => session },
      { prisma: fakePrisma },
      { isManagerOrAbove: (identity: { role: string }) => identity.role === "OWNER" || identity.role === "MANAGER" },
      { getPlanAccess: async () => ({ allowed: true }) },
    ][index];
    require.cache[path] = { id: path, filename: path, loaded: true, exports } as NodeJS.Module;
  });
  context.after(() => paths.forEach((path, index) => {
    if (originals[index]) require.cache[path] = originals[index]!;
    else delete require.cache[path];
  }));

  const { POST } = await import("../../app/api/tv-display/kiosk-token/route");
  const request = (body?: string, headers: HeadersInit = {}) => new NextRequest("https://lottoops.test/api/tv-display/kiosk-token", {
    method: "POST",
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body }),
  });

  await context.test("rejects unauthenticated requests", async () => {
    session = null;
    assert.equal((await POST(request())).status, 401);
  });

  await context.test("rejects non-manager staff", async () => {
    session = { userId: "employee", storeId: "store-a", role: "EMPLOYEE" };
    assert.equal((await POST(request())).status, 403);
  });

  session = { userId: "manager", storeId: "store-a", role: "MANAGER" };

  await context.test("rejects invalid screen bodies", async () => {
    for (const body of ["{\"screen\":0}", "{\"screen\":1.5}", "{\"screen\":\"2\"}", "{\"screen\":10001}", "not-json"]) {
      assert.equal((await POST(request(body))).status, 400, body);
    }
  });

  await context.test("keeps legacy empty-body links on screen 1", async () => {
    const response = await POST(request());
    assert.equal(response.status, 200);
    const payload = await response.json() as { kioskUrl: string };
    const url = new URL(payload.kioskUrl);
    assert.equal(url.searchParams.get("screen"), "1");
    assert.equal(url.searchParams.get("kiosk"), "1");
    const claims = await verifyTvKioskToken(url.searchParams.get("token")!);
    assert.equal(claims?.storeId, "store-a");
    assert.equal(claims?.storeName, "Store A");
  });

  await context.test("issues screen 2 links without accepting a cross-store selector", async () => {
    const response = await POST(request(JSON.stringify({ screen: 2, storeId: "store-b" })));
    assert.equal(response.status, 200);
    const payload = await response.json() as { kioskUrl: string };
    const url = new URL(payload.kioskUrl);
    assert.equal(url.searchParams.get("screen"), "2");
    assert.equal(url.searchParams.get("storeId"), null);
    const claims = await verifyTvKioskToken(url.searchParams.get("token")!);
    assert.equal(claims?.storeId, "store-a");
    assert.equal(claims?.storeName, "Store A");
  });
});
