import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { canAccessReports } from "../permissions";
import type { SessionPayload } from "../session";

const source = readFileSync(new URL("../../app/api/reports/shifts/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const employee: SessionPayload = {
  userId: "employee-1", storeId: "store-1", storeName: "Store", name: "Employee",
  email: "employee@example.com", role: "EMPLOYEE", grantedPermissions: [],
};

type QueryWhere = { storeId: string; id?: string; status: string; openedById?: string };
const shifts = [
  { id: "own-shift", storeId: "store-1", openedById: "employee-1" },
  { id: "coworker-shift", storeId: "store-1", openedById: "employee-2" },
  { id: "other-store-shift", storeId: "store-2", openedById: "employee-1" },
].map((shift) => ({
  ...shift, status: "CLOSED", openedAt: new Date("2026-10-13T08:00:00Z"),
  closedAt: new Date("2026-10-13T16:00:00Z"), openedBy: { name: "Operator" },
  closedBy: { name: "Closer" }, lines: [], inventoryAudit: null,
}));

function loadRoute(session: SessionPayload | null) {
  let query: QueryWhere | undefined;
  const prisma = {
    shift: {
      findMany: async ({ where }: { where: QueryWhere }) => {
        query = where;
        return shifts.filter((shift) =>
          shift.storeId === where.storeId && shift.status === where.status &&
          (!where.id || shift.id === where.id) &&
          (!where.openedById || shift.openedById === where.openedById));
      },
    },
    $queryRawUnsafe: async () => [],
  };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse: { json: Response.json.bind(Response) } },
    "@/lib/api-session": { getApiSession: async () => session },
    "@/lib/prisma": { prisma },
    "@/lib/permissions": { canAccessReports },
    "@/lib/ticket-quantity": {},
    "@/lib/core-validation": {},
  };
  const exports: { GET?: (request: Request) => Promise<Response> } = {};
  runInNewContext(compiled, {
    exports, URL, Date, Map,
    require: (name: string) => {
      assert.ok(name in dependencies, `Unexpected route dependency: ${name}`);
      return dependencies[name];
    },
  });
  assert.ok(exports.GET);
  return { get: exports.GET, query: () => query };
}

test("employees may retrieve only closed shifts they opened, scoped to their store", async () => {
  for (const [shiftId, expectedStatus] of [
    ["own-shift", 200], ["coworker-shift", 404], ["other-store-shift", 404],
  ] as const) {
    const route = loadRoute(employee);
    const response = await route.get(new Request(`http://localhost/api/reports/shifts?shiftId=${shiftId}`));
    assert.equal(response.status, expectedStatus);
    assert.equal(route.query()?.storeId, employee.storeId);
    assert.equal(route.query()?.openedById, employee.userId);
    assert.equal(route.query()?.status, "CLOSED");
  }
});

test("report-authorized roles can read coworkers' shifts but never other stores", async () => {
  for (const role of ["OWNER", "MANAGER", "AUDITOR", "SHIFT_LEAD"] as const) {
    const session = { ...employee, role, grantedPermissions: role === "SHIFT_LEAD" ? ["REPORTS"] : [] };
    const route = loadRoute(session);
    assert.equal((await route.get(new Request("http://localhost/api/reports/shifts?shiftId=coworker-shift"))).status, 200);
    assert.equal(route.query()?.openedById, undefined);
    assert.equal((await route.get(new Request("http://localhost/api/reports/shifts?shiftId=other-store-shift"))).status, 404);
  }
});

test("range reports require reporting permission and unauthenticated requests are rejected", async () => {
  const route = loadRoute(employee);
  assert.equal((await route.get(new Request("http://localhost/api/reports/shifts"))).status, 403);
  assert.equal(route.query(), undefined);
  const anonymous = loadRoute(null);
  assert.equal((await anonymous.get(new Request("http://localhost/api/reports/shifts?shiftId=own-shift"))).status, 401);
  assert.equal(anonymous.query(), undefined);
  const lead = loadRoute({ ...employee, role: "SHIFT_LEAD" });
  assert.equal((await lead.get(new Request("http://localhost/api/reports/shifts"))).status, 403);
});
