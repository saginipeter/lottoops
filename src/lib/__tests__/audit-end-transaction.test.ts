import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("ending audit locks the assigned shift before stock and completes from current physical observations", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../prisma", "../activity-log", "../inventory-notifications"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  let session: { userId: string; storeId: string; name: string; role: string; shiftId?: string } = { userId: "manager", storeId: "store", name: "Manager", role: "MANAGER" };
  let shiftIsOpen = true;
  let auditStatus = "OPEN";
  const lockOrder: string[] = [];
  let lineUpdate: Record<string, unknown> | null = null;
  let notifications = 0;
  const line = { id: "audit-line", packId: "pack", expectedTicket: 1, beginningPhysicalTicket: 1, endingPhysicalTicket: 11 };
  const audit = { id: "audit", shiftId: "shift", lines: [line] };
  const activePack = {
    id: "pack", currentTicketNumber: 141, firstTicket: 1, ticketQuantity: 150,
    firstOrLastTicket: "FIRST", game: { ticketsPerPack: 150 },
  };
  const tx = {
    $queryRawUnsafe: async (query: string) => {
      if (query.includes("FROM shifts")) { lockOrder.push("shift"); return shiftIsOpen ? [{ id: "shift" }] : []; }
      if (query.includes("FROM packs")) { lockOrder.push("packs"); return [{ id: "pack" }]; }
      return [];
    },
    inventoryAudit: {
      findFirst: async ({ where }: { where: { status?: string } }) => where.status === "OPEN" && auditStatus === "OPEN" ? audit : null,
      update: async ({ data }: { data: Record<string, unknown> }) => { auditStatus = String(data.status); return data; },
    },
    pack: { findMany: async () => [activePack] },
    inventoryAuditLine: { update: async ({ data }: { data: Record<string, unknown> }) => { lineUpdate = data; return data; } },
  };
  const prisma = {
    inventoryAudit: { findFirst: async () => ({ shiftId: "shift" }) },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const exports = [
    { getApiSession: async () => session },
    { prisma },
    { logInventoryActivity: async () => {} },
    { createInventoryNotification: async () => { notifications += 1; } },
  ];
  paths.forEach((path, index) => { require.cache[path] = { id: path, filename: path, loaded: true, exports: exports[index] } as NodeJS.Module; });
  context.after(() => paths.forEach((path, index) => {
    if (originals[index]) require.cache[path] = originals[index];
    else delete require.cache[path];
  }));

  const { POST } = await import("../../app/api/inventory-audits/end/route");
  const request = () => new NextRequest("http://localhost/api/inventory-audits/end", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId: "audit" }),
  });
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.equal(auditStatus, "COMPLETED");
  assert.deepEqual(lineUpdate, { endingExpectedTicket: 10, variance: 1 });
  assert.deepEqual(lockOrder, ["shift", "packs"]);
  assert.equal(notifications, 1);

  session = { userId: "employee", storeId: "store", name: "Employee", role: "EMPLOYEE", shiftId: "another-shift" };
  shiftIsOpen = false;
  lockOrder.length = 0;
  assert.equal((await POST(request())).status, 403, "an employee cannot end an audit for another shift");
  assert.deepEqual(lockOrder, [], "unauthorized employee access does not enter the audit transaction");
});
