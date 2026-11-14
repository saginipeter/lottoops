import assert from "node:assert/strict";
import test from "node:test";
import { buildMidShiftAuditSnapshotDocument, loadMidShiftAuditSnapshotDocument, type MidShiftAuditSnapshot } from "../mid-shift-audit-report";

function snapshot(): MidShiftAuditSnapshot {
  return {
    generatedAt: "2026-11-08T20:00:00.000Z",
    storeName: "Store",
    shift: { id: "shift-1", shiftNumber: 2, status: "OPEN", openedAt: "2026-11-08T08:00:00.000Z", openedBy: "Opening operator" },
    audit: { id: "audit-1", status: "OPEN", begunAt: "2026-11-08T08:05:00.000Z", begunBy: "Auditor", endedAt: null, endedBy: null },
    activeDisplayCount: 2,
    activePacks: [
      { display: "2", pack: "PACK-2", game: "Game 2", direction: "FIRST", openingExpectedTicket: 1, openingPhysicalTicket: 1, currentExpectedTicket: 8, closingPhysicalTicket: 9, provisionalVariance: 1, scanStatus: "Scanned; provisional" },
      { display: "10", pack: "PACK-10", game: "Game 10", direction: "LAST", openingExpectedTicket: 150, openingPhysicalTicket: 150, currentExpectedTicket: 0, closingPhysicalTicket: 0, provisionalVariance: 0, scanStatus: "Scanned; provisional" },
    ],
  };
}

test("mid-shift print document labels live values provisional and never calls them final sales or close data", () => {
  const document = buildMidShiftAuditSnapshotDocument(snapshot());
  assert.equal(document.title, "Mid-Shift Audit Snapshot");
  assert.equal(document.metadata?.find((item) => item.label === "Shift status")?.value, "OPEN");
  assert.equal(document.metadata?.find((item) => item.label === "Shift")?.value, "Shift 2");
  assert.equal(document.metadata?.find((item) => item.label === "Shift opened")?.value, "Nov 8, 2026, 2:00 AM");
  assert.equal(document.metadata?.find((item) => item.label === "Audit begun")?.value, "Nov 8, 2026, 2:05 AM");
  assert.equal(document.metadata?.find((item) => item.label === "Snapshot generated at")?.value, "Nov 8, 2026, 2:00 PM");
  assert.doesNotMatch(JSON.stringify(document), /shift-1|audit-1|Shift ID|Audit ID/);
  assert.deepEqual(document.sections[0].columns.slice(0, 2), ["Display #", "Pack"]);
  assert.deepEqual(document.sections[0].rows.map((row) => row[0]), ["2", "10"]);
  assert.equal(document.sections[0].rows[1][7], 0, "a zero scanned ticket is preserved, not treated as missing");
  assert.equal(document.sections[0].rows[1][8], "0");
  assert.match(document.notes?.join(" ") ?? "", /does not close the shift or complete an audit/);
  assert.match(document.notes?.join(" ") ?? "", /provisional/);
  assert.doesNotMatch(document.sections.map((section) => section.title).join(" "), /Sales Summary|Cash Reconciliation/);
});

test("mid-shift snapshot sorts Display # numerically without changing stored labels", () => {
  const value = snapshot();
  value.activePacks = [
    { ...value.activePacks[1], display: "10" },
    { ...value.activePacks[0], display: "2" },
    { ...value.activePacks[0], display: "01", pack: "PACK-01" },
  ];
  const rows = buildMidShiftAuditSnapshotDocument(value).sections[0].rows;
  assert.deepEqual(rows.map((row) => row[0]), ["01", "2", "10"]);
});

test("snapshot loader requests a fresh no-store snapshot for each call", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    assert.equal(url, "/api/inventory-audits/audit%20%2F%20one/snapshot");
    assert.deepEqual(init, { cache: "no-store" });
    return Response.json(snapshot());
  });
  const first = await loadMidShiftAuditSnapshotDocument("audit / one");
  const second = await loadMidShiftAuditSnapshotDocument("audit / one");
  assert.equal(calls, 2);
  assert.equal(first.title, second.title);
});
