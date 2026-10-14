import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { alertCategories, filterAndSortAlerts, getAlertCategory } from "@/components/alerts/alert-categories";
import { AlertsCenter } from "@/components/alerts/alerts-center";
import { getTvTarget, launchTvWindow, TvDisplayLauncher } from "@/components/home/tv-display-launcher";
import { PosHomeDashboard } from "@/components/home/pos-home-dashboard";

const stores = [{ id: "owned-a", name: "Store A" }, { id: "owned-b", name: "Store B" }];
const kioskUrlFor = (storeId: string) => {
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url")}.${Buffer.from(JSON.stringify({ type: "TV_KIOSK", storeId })).toString("base64url")}.mock-signature`;
  return `https://lottoops.example/tv-display?token=${token}&kiosk=1`;
};

test("platform action grid points to retained administration sections", () => {
  const source = readFileSync("src/components/platform/platform-control-center.tsx", "utf8");
  for (const id of ["store-access", "subscriptions", "feature-flags", "platform-activity", "role-permissions", "platform-users", "recent-accounts", "ocr-health", "store-health"]) {
    assert.ok(source.includes(`["${id}",`), `Missing action for ${id}`);
    assert.ok(source.includes(`id="${id}"`), `Missing destination for ${id}`);
  }
  assert.ok(source.includes("Create customer account"));
  assert.ok(source.includes('["platform-users", "Customer users", "Manage customer user accounts"]'));
  assert.ok(!source.includes("Monthly Recurring Revenue"));
  const overview = readFileSync("src/app/api/platform/overview/route.ts", "utf8");
  assert.ok(!overview.includes("mrrCents"));
  assert.ok(!overview.includes("monthlyPriceCents"));
});

test("alert center categorizes all seven queues and preserves the existing panels", () => {
  assert.deepEqual(alertCategories.map((category) => category.id), ["ALL", "LOW_STOCK", "SHIPMENT", "SECURITY", "SYSTEM", "RETURN", "TICKET", "AUDIT"]);
  const html = renderToStaticMarkup(createElement(AlertsCenter, {
    returns: "Return queue", shipments: "Shipment queue", discrepancies: "Audit queue", tickets: "Ticket queue",
  }));
  for (const label of ["Alert category", "Return queue", "Shipment queue", "Audit queue", "Ticket queue", "Operational Alerts"]) assert.ok(html.includes(label));
});

test("security warnings are distinct from device failures and never fabricated", () => {
  assert.equal(getAlertCategory("SECURITY_WARNING"), "SECURITY");
  assert.equal(getAlertCategory("DEVICE_HEALTH"), "SYSTEM");
  assert.equal(getAlertCategory("SYSTEM_ERROR"), "SYSTEM");
  assert.equal(getAlertCategory("INVENTORY_AUDIT_VARIANCE"), "AUDIT");
  const device = { type: "DEVICE_HEALTH", severity: "HIGH", createdAt: "2026-10-01" };
  assert.deepEqual(filterAndSortAlerts([device], "SECURITY", "SEVERITY"), []);
});

test("operational category filtering and severity/newest/oldest sorting are stable and non-mutating", () => {
  const alerts = [
    { id: "medium", type: "SHIPMENT_OVERRIDE", severity: "MEDIUM", createdAt: "2026-10-03" },
    { id: "urgent", type: "INCOMPLETE_AUDIT", severity: "URGENT", createdAt: "2026-10-01" },
    { id: "high-old", type: "LOW_TICKETS", severity: "HIGH", createdAt: "2026-10-02" },
    { id: "high-new", type: "LOW_TICKETS", severity: "HIGH", createdAt: "2026-10-04" },
  ];
  const ids = (items: typeof alerts) => items.map((alert) => alert.id);
  assert.deepEqual(ids(filterAndSortAlerts(alerts, "ALL", "SEVERITY")), ["urgent", "high-new", "high-old", "medium"]);
  assert.deepEqual(ids(filterAndSortAlerts(alerts, "ALL", "NEWEST")), ["high-new", "medium", "high-old", "urgent"]);
  assert.deepEqual(ids(filterAndSortAlerts(alerts, "ALL", "OLDEST")), ["urgent", "high-old", "medium", "high-new"]);
  assert.deepEqual(ids(filterAndSortAlerts(alerts, "LOW_STOCK", "NEWEST")), ["high-new", "high-old"]);
  assert.deepEqual(ids(alerts), ["medium", "urgent", "high-old", "high-new"]);
  assert.equal(getAlertCategory("STALE_RECEIVING"), "SHIPMENT");
});

test("owner TV selection defaults only to a verified current owned store, not an arbitrary location", () => {
  assert.equal(getTvTarget(stores, "owned-b")?.id, "owned-b");
  assert.equal(getTvTarget(stores), undefined);
  assert.equal(getTvTarget(stores, "foreign-store"), undefined);
  assert.equal(getTvTarget([stores[0]]), undefined);
});

test("TV launcher reserves a window synchronously, verifies its current store scope, and opens live kiosk directly", async () => {
  const events: string[] = [];
  const popup = { opener: {} as unknown, location: { href: "about:blank" }, closed: false, close() { events.push("close"); } };
  const request: typeof fetch = async (url, init) => {
    events.push("request");
    assert.equal(url, "/api/tv-display/kiosk-token");
    assert.equal(init?.method, "POST");
    assert.equal(popup.opener, null);
    return Response.json({ kioskUrl: kioskUrlFor("owned-b") });
  };
  await launchTvWindow("owned-b", () => { events.push("open"); return popup; }, request);
  assert.deepEqual(events, ["open", "request"]);
  assert.equal(popup.location.href, kioskUrlFor("owned-b"));
});

test("TV launcher rejects a kiosk token for a different store, including a session race", async () => {
  let closed = false;
  const popup = { opener: null, location: { href: "about:blank" }, closed: false, close() { closed = true; } };
  await assert.rejects(launchTvWindow("owned-a", () => popup, async () => Response.json({ kioskUrl: kioskUrlFor("owned-b") })), /does not match your current store/);
  assert.equal(closed, true);
  assert.equal(popup.location.href, "about:blank");
});

test("TV popup blockers and token failures surface errors without leaving a blank window", async () => {
  let requested = false;
  const request: typeof fetch = async () => { requested = true; return Response.json({ error: "Live Display is not enabled for this plan." }, { status: 403 }); };
  await assert.rejects(launchTvWindow("owned-a", () => null, request), /Allow popups/);
  assert.equal(requested, false);
  let closed = false;
  const popup = { opener: null, location: { href: "about:blank" }, closed: false, close() { closed = true; } };
  await assert.rejects(launchTvWindow("owned-a", () => popup, request), /not enabled/);
  assert.equal(closed, true);
  assert.equal(popup.location.href, "about:blank");
});

test("TV launcher rejects invalid links and doesn't navigate to settings instead", async () => {
  for (const kioskUrl of ["javascript:alert(1)", "https://lottoops.example/settings/tv-display", "https://lottoops.example/tv-display?kiosk=1"]) {
    let closed = false;
    const popup = { opener: null, location: { href: "about:blank" }, closed: false, close() { closed = true; } };
    await assert.rejects(launchTvWindow("owned-a", () => popup, async () => Response.json({ kioskUrl })), /invalid/);
    assert.equal(closed, true);
  }
});

test("manager and owner main workspaces expose the prominent TV launcher, but employee workspace does not", () => {
  for (const role of ["MANAGER", "OWNER"]) {
    const html = renderToStaticMarkup(createElement(PosHomeDashboard, {
      storeName: "Store A", storeId: "owned-a", role, grantedPermissions: [], tvStores: stores,
    }));
    assert.ok(html.includes("Open TV Display Board"));
  }
  const employee = renderToStaticMarkup(createElement(PosHomeDashboard, { storeName: "Store A", role: "EMPLOYEE", grantedPermissions: [] }));
  assert.ok(!employee.includes("Open TV Display Board"));
  const owner = renderToStaticMarkup(createElement(TvDisplayLauncher, { stores, currentStoreId: "foreign-store" }));
  assert.ok(owner.includes("not an accessible owned store"));
  assert.match(owner, /<button[^>]*disabled=""/);
});
