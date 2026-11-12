import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("operational alerts expose readable pack/game labels and persist manager clear acknowledgments", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../prisma", "../device-registry"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  let session: { userId: string; storeId: string; name: string; role: string } | null = { userId: "manager", storeId: "store", name: "Manager", role: "MANAGER" };
  const acknowledgments = new Map<string, { resolved: boolean }>();
  const acknowledgmentWrites: unknown[][] = [];
  let lowTicketCount = 4;
  let displayPackNumber: string | null = "00017";
  const notification = {
    id: "notification-1", notificationType: "TICKET_EXCEPTION", title: "Out-of-sequence ticket scan",
    detail: "Employee scanned an out-of-order ticket for Pack #00017 · Game #0042; expected ticket 002.", severity: "HIGH",
    createdAt: new Date("2026-11-11T18:00:00.000Z"), entityId: "pack-1", packNumber: "00017" as string | null, gameNumber: "0042",
  };
  const fakePrisma = {
    pack: {
      findMany: async ({ select }: { select?: Record<string, unknown> }) => select?.packNumber
        ? lowTicketCount <= 5 ? [{ id: "pack-1", serialNumber: "12345678901", packNumber: displayPackNumber, currentTicketNumber: lowTicketCount, slot: { slotNumber: "08" }, game: { name: "Lucky Game", gameNumber: "0042" } }] : []
        : [{ id: "pack-1" }],
    },
    shift: { findMany: async () => [] },
    shipment: { findMany: async () => [] },
    $queryRawUnsafe: async (sql: string, ...values: unknown[]) => {
      if (sql.includes("FROM store_devices")) return [];
      if (sql.includes("FROM inventory_activity_logs")) return [];
      if (sql.includes("FROM operational_alert_acknowledgments")) return [...acknowledgments].filter(([, row]) => !row.resolved).map(([alertKey]) => ({ alertKey }));
      if (sql.includes("FROM inventory_notifications n")) {
        assert.match(sql, /notification_type AS "notificationType"/);
        assert.match(sql, /p\."packNumber" AS "packNumber"/);
        assert.match(sql, /REGEXP_REPLACE/);
        assert.match(sql, /CONCAT\('Pack ', p\.id\)/);
        assert.match(sql, /g\."gameNumber"/);
        assert.doesNotMatch(sql, /COALESCE\(p\."packNumber", p\."serialNumber"\)/);
        return [notification];
      }
      if (sql.includes("FROM inventory_notifications WHERE id = $1")) {
        return [{ exists: values[0] === notification.id && values[1] === "store" && values[2] === "TICKET_EXCEPTION" }];
      }
      if (sql.includes("FROM packs p")) {
        return [{ exists: values[0] === "pack-1" && values[1] === "store" && lowTicketCount <= 5 }];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    $executeRawUnsafe: async (sql: string, ...values: unknown[]) => {
      if (sql.includes("UPDATE operational_alert_acknowledgments")) {
        const activeKeys = new Set(values[1] as string[]);
        for (const [key, row] of acknowledgments) if (!activeKeys.has(key)) row.resolved = true;
        return 1;
      }
      assert.match(sql, /INSERT INTO operational_alert_acknowledgments/);
      assert.match(sql, /ON CONFLICT \(store_id, alert_key\) DO UPDATE/);
      assert.doesNotMatch(sql, /DELETE FROM|UPDATE inventory_notifications|UPDATE inventory_activity_logs/);
      acknowledgmentWrites.push(values);
      acknowledgments.set(String(values[2]), { resolved: false });
      return 1;
    },
  };
  require.cache[paths[0]] = { id: paths[0], filename: paths[0], loaded: true, exports: { getApiSession: async () => session } } as NodeJS.Module;
  require.cache[paths[1]] = { id: paths[1], filename: paths[1], loaded: true, exports: { prisma: fakePrisma } } as NodeJS.Module;
  require.cache[paths[2]] = { id: paths[2], filename: paths[2], loaded: true, exports: { ensureDeviceRegistrySchema: async () => {} } } as NodeJS.Module;
  context.after(() => paths.forEach((path, index) => {
    if (originals[index]) require.cache[path] = originals[index];
    else delete require.cache[path];
  }));

  const { GET } = await import("../../app/api/alerts/operational/route");
  const { POST: clear } = await import("../../app/api/alerts/operational/clear/route");
  const clearRequest = (alertKey = "NOTIFICATION:notification-1", type = "TICKET_EXCEPTION") => new NextRequest("http://localhost/api/alerts/operational/clear", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alertKey, type }),
  });

  const initialResponse = await GET();
  assert.equal(initialResponse.status, 200);
  const initial = await initialResponse.json();
  const lowStock = initial.alerts.find((alert: { type: string }) => alert.type === "LOW_TICKETS");
  const exception = initial.alerts.find((alert: { type: string }) => alert.type === "TICKET_EXCEPTION");
  assert.equal(lowStock.packNumber, "00017");
  assert.equal(lowStock.gameNumber, "0042");
  assert.equal(exception.type, "TICKET_EXCEPTION");
  assert.equal(exception.packNumber, "00017");
  assert.equal(exception.gameNumber, "0042");
  assert.ok(exception.detail.includes("Game #0042"));
  assert.ok(!exception.detail.includes("12345678901"));

  displayPackNumber = null;
  notification.packNumber = null;
  notification.detail = "Employee scanned an out-of-order ticket for Pack #not recorded; expected ticket 002.";
  const missingPackNumberResponse = await GET();
  const missingPackNumberData = await missingPackNumberResponse.json();
  const missingPackNumber = missingPackNumberData.alerts.find((alert: { type: string }) => alert.type === "TICKET_EXCEPTION");
  const missingLowStockNumber = missingPackNumberData.alerts.find((alert: { type: string }) => alert.type === "LOW_TICKETS");
  assert.equal(missingPackNumber.packNumber, null);
  assert.equal(missingLowStockNumber.packNumber, null);
  assert.ok(!missingPackNumber.detail.includes("12345678901"));

  session = { ...session!, role: "EMPLOYEE" };
  assert.equal((await clear(clearRequest())).status, 403);
  assert.equal(acknowledgmentWrites.length, 0);
  session = { ...session!, role: "MANAGER" };
  assert.equal((await clear(clearRequest())).status, 200);
  assert.equal(acknowledgmentWrites.length, 1);
  assert.equal(acknowledgmentWrites[0][1], "store");
  assert.equal(acknowledgmentWrites[0][2], "NOTIFICATION:notification-1");

  const refreshed = await GET();
  const afterClear = await refreshed.json();
  assert.ok(!afterClear.alerts.some((alert: { id: string }) => alert.id === "NOTIFICATION_notification-1"));
  assert.ok(afterClear.alerts.some((alert: { type: string }) => alert.type === "LOW_TICKETS"));

  assert.equal((await clear(clearRequest("LOW_TICKETS:pack-1", "LOW_TICKETS"))).status, 200);
  assert.equal(acknowledgmentWrites.length, 2);
  const whileStillLow = await GET();
  assert.ok(!(await whileStillLow.json()).alerts.some((alert: { id: string }) => alert.id === "LOW_TICKETS_pack-1"));
  lowTicketCount = 6;
  const resolved = await GET();
  assert.ok(!(await resolved.json()).alerts.some((alert: { id: string }) => alert.id === "LOW_TICKETS_pack-1"));
  assert.equal(acknowledgments.get("LOW_TICKETS:pack-1")?.resolved, true, "acknowledgment history is retained but no longer hides later episodes");
  lowTicketCount = 4;
  const recurring = await GET();
  assert.ok((await recurring.json()).alerts.some((alert: { id: string }) => alert.id === "LOW_TICKETS_pack-1"));

  session = { ...session!, storeId: "another-store" };
  assert.equal((await clear(clearRequest())).status, 404, "foreign-store alert sources cannot be acknowledged");
});
