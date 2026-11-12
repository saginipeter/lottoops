import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("discrepancy report replaces legacy audit Pack CUIDs with Pack # and Game #", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../prisma", "../permissions", "../discrepancy-resolution"]
    .map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  const session = { userId: "manager", storeId: "store-1", role: "MANAGER" };
  const auditLine = {
    id: "audit-line-1", slotNumber: "08", expectedTicket: 62, endingExpectedTicket: 62,
    beginningPhysicalTicket: 61, endingPhysicalTicket: 63, variance: 1,
    varianceReason: "Pack cmvzmngub002jla08ddeayzmp: expected physical ticket 62, observed 63.",
    pack: { packNumber: "00017", serialNumber: "serial-should-not-be-used", game: { name: "Lucky Game", gameNumber: "0042" } },
    audit: { status: "COMPLETED", begunAt: new Date("2026-11-11T08:00:00Z"), endedAt: new Date("2026-11-11T16:00:00Z"), begunBy: { name: "Opener" }, endedBy: { name: "Closer" } },
  };
  const fakePrisma = {
    pack: { findMany: async () => [] },
    inventoryAuditLine: {
      findMany: async (query: { include: { pack: { select: { packNumber?: boolean; game?: { select?: { gameNumber?: boolean } } } } } }) => {
        assert.equal(query.include.pack.select.packNumber, true);
        assert.equal(query.include.pack.select.game?.select?.gameNumber, true);
        return [auditLine];
      },
    },
  };
  const replacements = [
    { getApiSession: async () => session },
    { prisma: fakePrisma },
    { canAccessReports: () => true },
    { getResolutionMap: async () => new Map() },
  ];
  paths.forEach((path, index) => {
    require.cache[path] = { id: path, filename: path, loaded: true, exports: replacements[index] } as NodeJS.Module;
  });
  context.after(() => paths.forEach((path, index) => {
    if (originals[index]) require.cache[path] = originals[index];
    else delete require.cache[path];
  }));

  const { GET } = await import("../../app/api/reports/discrepancies/route");
  const response = await GET(new NextRequest("http://localhost/api/reports/discrepancies?from=2026-11-11&to=2026-11-11"));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.auditVariances[0].pack, "00017");
  assert.equal(data.auditVariances[0].gameNumber, "0042");
  assert.equal(data.auditVariances[0].reason, "Pack #00017 · Game #0042: expected physical ticket 62, observed 63.");
  assert.doesNotMatch(JSON.stringify(data), /cmvzmngub002jla08ddeayzmp|serial-should-not-be-used/);
});
