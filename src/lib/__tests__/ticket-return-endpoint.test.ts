import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";
import { buildTicketReturnRequestsDocument } from "../workspace-detail-report-documents";

test("ticket return endpoints restore immediately and resolve reviews without repeating returns", async (context) => {
  const require = createRequire(import.meta.url);
  const sessionPath = require.resolve("../api-session");
  const prismaPath = require.resolve("../prisma");
  const originals = [require.cache[sessionPath], require.cache[prismaPath]];
  const staff = { userId: "staff", storeId: "store", name: "Staff", role: "EMPLOYEE" };
  let session: typeof staff | null = staff;
  const initial = () => ({
    pack: { id: "pack", storeId: "store", serialNumber: "P1", status: "ACTIVE", currentTicketNumber: 9, firstTicket: 1, ticketQuantity: 10, ticketPrice: null as number | null, game: { price: 5 }, completedAt: null },
    shift: { id: "shift", storeId: "store", status: "OPEN", lines: [{ id: "line", packId: "pack", slotNumber: "1", beginningTicket: 10, endingTicket: 9, ticketsSold: 1, salesAmount: 5 }] },
    slot: { id: "slot", storeId: "store", packId: "pack" as string | null },
    // Deliberately older than two minutes and sold by somebody else.
    events: [{ id: "sale", ticketBarcode: "barcode", scannedAt: new Date("2020-01-01"), scannedById: "other-staff" }],
    requests: [] as Array<{ id: string; storeId: string; shiftId: string; packId: string; status: string }>,
    notifications: [] as string[],
  });
  let state = initial();
  let fail = "";
  let calls: string[] = [];
  let transactionTail = Promise.resolve();
  const reset = () => { state = initial(); session = { ...staff }; fail = ""; calls = []; };
  type Query = { where: Record<string, unknown>; data?: Record<string, unknown> };
  const fakePrisma = {
    pack: {
      findFirst: async ({ where }: Query) => {
        calls.push("pack.read");
        return where.id === state.pack.id && where.storeId === state.pack.storeId ? state.pack : null;
      },
      updateMany: async ({ where, data }: Query) => {
        calls.push("pack.write");
        assert.equal(where.storeId, "store");
        assert.equal(where.currentTicketNumber, state.pack.currentTicketNumber);
        if (fail === "pack") return { count: 0 };
        Object.assign(state.pack, data);
        return { count: 1 };
      },
    },
    shift: {
      findFirst: async ({ where }: Query) => {
        calls.push("shift.read");
        return where.id === state.shift.id && where.storeId === state.shift.storeId ? state.shift : null;
      },
    },
    shiftLine: {
      update: async ({ data }: Query) => {
        calls.push("line.write");
        Object.assign(state.shift.lines[0], data);
      },
    },
    displaySlot: {
      findFirst: async ({ where }: Query) => {
        calls.push("slot.read");
        assert.equal(where.storeId, "store");
        return fail === "missing-slot" ? null : state.slot;
      },
      updateMany: async ({ where, data }: Query) => {
        calls.push("slot.write");
        assert.equal(where.packId, state.slot.packId);
        if (fail === "slot") return { count: 0 };
        Object.assign(state.slot, data);
        return { count: 1 };
      },
    },
    scanLogEntry: { create: async () => { calls.push("audit.write"); } },
    $queryRawUnsafe: async (sql: string, ...values: unknown[]) => {
      calls.push("query");
      if (sql.includes("FOR UPDATE")) {
        assert.equal(typeof values[0], "string");
        assert.equal(values[1], session?.storeId);
        if (sql.includes("status = 'OPEN'")) {
          assert.match(sql, /FROM shifts/);
          return state.shift.status === "OPEN" && fail !== "close-race" ? [{ id: state.shift.id }] : [];
        }
        return [{ id: values[0] }];
      }
      if (sql.includes("FROM live_scan_events")) {
        assert.deepEqual(values, [session?.storeId, "shift", "pack"]);
        assert.match(sql, /ORDER BY scanned_at DESC, id DESC/);
        return state.events.slice(-1);
      }
      assert.match(sql, /status IN \('PENDING', 'RETURNED_PENDING_REVIEW'\)/);
      const unresolved = state.requests.filter((r) => ["PENDING", "RETURNED_PENDING_REVIEW"].includes(r.status));
      if (sql.includes("r.created_at DESC")) {
        assert.deepEqual(values, [session?.role === "OWNER" ? session.userId : session?.storeId]);
        return unresolved;
      }
      const allowed = sql.includes('stores."ownerUserId"')
        ? values[1] === "owner"
        : values[1] === "store";
      return allowed ? unresolved.filter((r) => r.id === values[0]) : [];
    },
    $executeRawUnsafe: async (sql: string, ...values: unknown[]) => {
      if (sql.includes("CREATE ")) return 0;
      calls.push("execute");
      if (sql.includes("INSERT INTO inventory_notifications")) {
        assert.match(sql, /TICKET_RETURN_REVIEW/);
        if (fail === "notification") throw new Error("notification unavailable");
        state.notifications.push(String(values[2]));
        return 1;
      }
      if (sql.includes("INSERT INTO ticket_return_requests")) {
        assert.match(sql, /'RETURNED_PENDING_REVIEW'/);
        state.requests.push({ id: String(values[0]), storeId: String(values[1]), shiftId: String(values[2]), packId: String(values[3]), status: "RETURNED_PENDING_REVIEW" });
        return 1;
      }
      if (sql.includes("DELETE FROM live_scan_events")) {
        if (fail === "event") return 0;
        if (sql.includes("WHERE id IN")) {
          state.events.pop();
          return 1;
        }
        assert.deepEqual(values.slice(1), ["store", "shift", "pack"]);
        const index = state.events.findIndex((event) => event.id === values[0]);
        if (index < 0) return 0;
        state.events.splice(index, 1);
        return 1;
      }
      assert.match(sql, /UPDATE ticket_return_requests/);
      assert.match(sql, /WHERE id = \$1[\s\S]*status /);
      const row = state.requests.find((r) => r.id === values[0]);
      if (!row || !["PENDING", "RETURNED_PENDING_REVIEW"].includes(row.status) || fail === "resolved") return 0;
      if (sql.includes("status = 'RETURN_REVIEW_APPROVED'")) {
        assert.equal(row.status, "RETURNED_PENDING_REVIEW");
        row.status = "RETURN_REVIEW_APPROVED";
      } else if (sql.includes("CASE WHEN status")) {
        row.status = row.status === "RETURNED_PENDING_REVIEW" ? "RETURN_REVIEW_DENIED" : "DENIED";
      } else {
        assert.equal(row.status, "PENDING");
        row.status = "APPROVED";
      }
      return 1;
    },
    $transaction: async (callback: (tx: object) => Promise<unknown>, options?: { isolationLevel: string }): Promise<unknown> => {
      calls.push("transaction");
      if (options) assert.equal(options.isolationLevel, "Serializable");
      const previous = transactionTail;
      let release = () => {};
      transactionTail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const before = structuredClone(state);
      try {
        if (fail === "serialization") throw Object.assign(new Error("transaction conflict"), { code: "P2034" });
        return await callback(fakePrisma);
      }
      catch (error) { state = before; throw error; }
      finally { release(); }
    },
  };
  require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: { getApiSession: async () => session } } as NodeJS.Module;
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma: fakePrisma } } as NodeJS.Module;
  context.after(() => {
    for (const [index, path] of [sessionPath, prismaPath].entries()) {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    }
  });
  const { POST, GET } = await import("../../app/api/tickets/return-requests/route");
  const { POST: approve } = await import("../../app/api/tickets/return-requests/[id]/approve/route");
  const { POST: deny } = await import("../../app/api/tickets/return-requests/[id]/deny/route");
  const request = (overrides: Record<string, unknown> = {}) => new NextRequest("http://localhost/api/tickets/return-requests", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packId: "pack", shiftId: "shift", ticketBarcode: "barcode", reason: "Customer declined", ...overrides }),
  });
  const resolve = (action: typeof approve, id = state.requests[0]?.id ?? "missing") => action(request(), { params: Promise.resolve({ id }) });

  await context.test("authentication, operational roles and mandatory fields gate writes", async () => {
    reset(); session = null;
    for (const action of [POST, GET, (req: NextRequest) => approve(req, { params: Promise.resolve({ id: "x" }) }), (req: NextRequest) => deny(req, { params: Promise.resolve({ id: "x" }) })]) {
      assert.equal((await action(request())).status, 401);
    }
    assert.equal(calls.length, 0);
    for (const role of ["AUDITOR", "PLATFORM_ADMIN", "invalid"]) {
      session = { ...staff, role };
      assert.equal((await POST(request())).status, 403);
    }
    session = staff;
    for (const overrides of [{ packId: "" }, { shiftId: "" }, { ticketBarcode: "" }, { reason: "short" }]) {
      assert.equal((await POST(request(overrides))).status, 400);
    }
    assert.equal(calls.length, 0);
    assert.equal((await GET()).status, 403);
    assert.equal((await resolve(approve)).status, 403);
    assert.equal((await resolve(deny)).status, 403);
  });

  await context.test("all permitted staff restore older tickets sold by other staff without limits", async () => {
    for (const role of ["EMPLOYEE", "SHIFT_LEAD", "MANAGER", "OWNER"]) {
      reset(); session = { ...staff, role };
      // Prior completed self-returns must not impose the old three-return limit.
      state.requests = Array.from({ length: 4 }, (_, index) => ({ id: `old-${index}`, storeId: "store", shiftId: "shift", packId: "pack", status: "APPROVED_SELF" }));
      const response = await POST(request());
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.mode, "returned-pending-review");
      assert.equal(data.status, "RETURNED_PENDING_REVIEW");
      assert.equal(data.currentTicketNumber, 10);
      assert.equal(data.ticketsSold, 0);
      assert.equal(data.salesAmount, 0);
      assert.equal(state.events.length, 0);
      assert.equal(state.shift.lines[0].endingTicket, 10);
      assert.equal(state.shift.lines[0].salesAmount, 0);
      assert.deepEqual(state.notifications, [data.id]);
      assert.equal(state.requests.at(-1)?.status, "RETURNED_PENDING_REVIEW");
      assert.equal((await POST(request())).status, 409);
      assert.equal(state.notifications.length, 1);
    }
  });

  await context.test("sold-out packs restore into an empty original slot with consistent counts", async () => {
    reset(); state.pack.status = "SOLD_OUT"; state.pack.currentTicketNumber = 0; state.slot.packId = null;
    assert.equal((await POST(request())).status, 200);
    assert.equal(state.pack.status, "ACTIVE");
    assert.equal(state.pack.currentTicketNumber, 1);
    assert.equal(state.slot.packId, "pack");
    assert.equal(state.shift.lines[0].ticketsSold, 9);
    assert.equal(state.shift.lines[0].salesAmount, 45);
  });

  await context.test("sales totals use the same pack-specific price as the sell endpoint", async () => {
    reset(); state.pack.currentTicketNumber = 8; state.pack.ticketPrice = 10;
    const response = await POST(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).salesAmount, 10);
    assert.equal(state.shift.lines[0].ticketsSold, 1);
    assert.equal(state.shift.lines[0].salesAmount, 10);
  });

  await context.test("scope, open shifts, latest barcode, sale counts and slot occupancy are protected", async () => {
    for (const scenario of ["foreign-store", "foreign-pack", "foreign-shift", "closed", "no-line", "wrong-barcode", "missing-event", "no-sale", "negative-count", "inactive", "occupied", "missing-slot"]) {
      reset();
      if (scenario === "foreign-store") session = { ...staff, storeId: "elsewhere" };
      if (scenario === "closed") state.shift.status = "CLOSED";
      if (scenario === "no-line") state.shift.lines = [];
      if (scenario === "missing-event") state.events = [];
      if (scenario === "no-sale") state.pack.currentTicketNumber = 10;
      if (scenario === "negative-count") state.pack.currentTicketNumber = -1;
      if (scenario === "inactive") state.pack.status = "BACK_STOCK";
      if (scenario === "occupied") state.slot.packId = "other-pack";
      if (scenario === "missing-slot") fail = scenario;
      const overrides = scenario === "foreign-pack" ? { packId: "foreign" } : scenario === "foreign-shift" ? { shiftId: "foreign" } : scenario === "wrong-barcode" ? { ticketBarcode: "older" } : {};
      const response = await POST(request(overrides));
      assert.equal(response.status, scenario.startsWith("foreign-") ? 404 : 409, scenario);
      assert.equal(state.requests.length, 0, scenario);
      assert.equal(state.notifications.length, 0, scenario);
      assert.ok(!calls.includes("pack.write"), scenario);
    }
  });

  await context.test("simultaneous duplicate returns restore and notify only once", async () => {
    reset();
    const responses = await Promise.all([POST(request()), POST(request())]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    assert.equal(state.pack.currentTicketNumber, 10);
    assert.equal(state.requests.length, 1);
    assert.equal(state.notifications.length, 1);
  });

  await context.test("CAS, event, slot, serialization and required notification failures roll back every return change", async (subcontext) => {
    subcontext.mock.method(console, "error", () => {});
    for (const failure of ["pack", "event", "slot", "serialization", "notification"]) {
      reset(); fail = failure;
      const before = structuredClone(state);
      const response = await POST(request());
      assert.equal(response.status, failure === "notification" ? 500 : 409, failure);
      assert.deepEqual(state, before, failure);
    }
  });

  await context.test("printed return reviews distinguish already-restored tickets from legacy approval requests", () => {
    const record = {
      id: "return", storeId: "store", shiftId: "shift", packId: "pack", ticketBarcode: "barcode",
      reason: "Customer declined", requestedByName: "Staff", createdAt: "2026-10-14T12:00:00Z",
      serialNumber: "P1", gameName: "Game", gameNumber: "1",
    };
    const document = buildTicketReturnRequestsDocument([
      { ...record, status: "RETURNED_PENDING_REVIEW" },
      { ...record, id: "legacy", status: "PENDING" },
    ]);
    assert.equal(document.sections[0].rows[0][8], "Already returned; review only. Reason: Customer declined");
    assert.equal(document.sections[0].rows[1][8], "Customer declined");
    assert.match(String(document.metadata?.[0].value), /reviews do not change inventory or sales/);
  });

  await context.test("both new reviews and legacy requests list under store/owner scope", async () => {
    reset(); session = { ...staff, role: "MANAGER" };
    state.requests = [
      { id: "new", storeId: "store", shiftId: "shift", packId: "pack", status: "RETURNED_PENDING_REVIEW" },
      { id: "legacy", storeId: "store", shiftId: "shift", packId: "pack", status: "PENDING" },
    ];
    assert.equal((await (await GET()).json()).requests.length, 2);
    session = { ...staff, role: "OWNER", userId: "owner" };
    assert.equal((await (await GET()).json()).requests.length, 2);
  });

  await context.test("approve/deny reviews never touch inventory or sales even after resale or shift close", async () => {
    for (const action of [approve, deny]) {
      reset();
      assert.equal((await POST(request())).status, 200);
      state.pack.currentTicketNumber = 9; state.pack.status = "SOLD_OUT";
      state.shift.status = "CLOSED";
      state.events.push({ id: "resold", ticketBarcode: "barcode", scannedAt: new Date(), scannedById: "staff" });
      state.shift.lines[0].endingTicket = 9; state.shift.lines[0].ticketsSold = 1; state.shift.lines[0].salesAmount = 5;
      const inventoryBefore = structuredClone({ pack: state.pack, shift: state.shift, events: state.events, slot: state.slot });
      session = { ...staff, role: "MANAGER" }; calls = [];
      assert.equal((await resolve(action)).status, 200);
      assert.deepEqual({ pack: state.pack, shift: state.shift, events: state.events, slot: state.slot }, inventoryBefore);
      assert.deepEqual(calls, ["query", "execute"]);
      assert.equal(state.requests[0].status, action === approve ? "RETURN_REVIEW_APPROVED" : "RETURN_REVIEW_DENIED");
      assert.equal((await resolve(action)).status, 404);
      assert.equal((await resolve(action === approve ? deny : approve)).status, 404);
    }
  });

  await context.test("manager/owner cannot resolve requests outside their scope and racing resolutions fail", async () => {
    reset(); await POST(request());
    session = { ...staff, role: "MANAGER", storeId: "elsewhere" };
    assert.equal((await resolve(approve)).status, 404);
    assert.equal((await resolve(deny)).status, 404);
    session = { ...staff, role: "OWNER", userId: "wrong-owner" };
    assert.equal((await resolve(approve)).status, 404);
    assert.equal((await resolve(deny)).status, 404);
    session = { ...staff, role: "OWNER", userId: "owner" }; fail = "resolved";
    assert.equal((await resolve(approve)).status, 409);
    assert.equal((await resolve(deny)).status, 409);
  });

  await context.test("legacy PENDING approval still restores once, denial leaves its sale intact", async () => {
    for (const action of [approve, deny]) {
      reset(); session = { ...staff, role: "MANAGER" };
      state.requests.push({ id: "legacy", storeId: "store", shiftId: "shift", packId: "pack", status: "PENDING" });
      assert.equal((await resolve(action)).status, 200);
      assert.equal(state.requests[0].status, action === approve ? "APPROVED" : "DENIED");
      assert.equal(state.pack.currentTicketNumber, action === approve ? 10 : 9);
      assert.equal(state.events.length, action === approve ? 0 : 1);
      assert.equal((await resolve(action)).status, 404);
    }
  });

  await context.test("legacy approval rejects closed shifts and rolls back concurrent close or slot occupation", async () => {
    for (const scenario of ["closed", "close-race", "slot"]) {
      reset(); session = { ...staff, role: "MANAGER" };
      state.requests.push({ id: "legacy", storeId: "store", shiftId: "shift", packId: "pack", status: "PENDING" });
      if (scenario === "closed") state.shift.status = "CLOSED";
      else fail = scenario;
      const before = structuredClone(state);
      assert.equal((await resolve(approve)).status, 409, scenario);
      assert.deepEqual(state, before, scenario);
      assert.equal(state.requests[0].status, "PENDING", scenario);
    }
  });
});
