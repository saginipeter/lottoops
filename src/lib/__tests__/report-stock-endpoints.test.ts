import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

function line(id: string, gameNumber: string, beginning: number, sold: number, sales: string, ending: number | null) {
  return {
    packId: `pack-${id}-${beginning}`, slotNumber: "01",
    beginningTicket: beginning, endingTicket: ending, ticketsSold: sold, salesAmount: sales,
    pack: {
      serialNumber: `serial-${id}`, firstTicket: 1, ticketQuantity: 300, firstOrLastTicket: "FIRST",
      // Current prices deliberately differ from finalized sales.
      game: { id, gameNumber, name: id === "game-c" ? 'Third, "Game"' : "Same Name", price: "99.00", ticketsPerPack: 300 },
    },
  };
}

function shift(id: string, lines: ReturnType<typeof line>[]) {
  return {
    id, openedAt: new Date("2026-10-01T08:00:00Z"), closedAt: new Date("2026-10-01T16:00:00Z"),
    openedBy: { name: "Opener" }, closedBy: { name: "Closer" }, inventoryAudit: null, lines,
  };
}

const example = shift("shift-one", [
  line("game-a", "001", 100, 10, "50.00", 90),
  line("game-a", "001", 50, 10, "50.00", 40),
  line("game-b", "002", 100, 10, "50.00", 90),
  line("game-c", "003", 200, 20, "100.00", 180),
]);

// Parses CSV quoting as well as commas embedded in game names.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value); value = "";
    } else if (char === "\r" && text[i + 1] === "\n" && !quoted) {
      row.push(value); rows.push(row); row = []; value = ""; i += 1;
    } else value += char;
  }
  row.push(value); rows.push(row);
  return rows;
}

test("report endpoints expose historical, shift-scoped stock and finalized-sales cost", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../prisma", "../activity-log"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  let session: { storeId: string; storeName: string } | null = null;
  let shifts = [example];
  const queries: Array<{ where: Record<string, unknown>; include: { lines: { include: { pack: { include: { game: { select: Record<string, boolean> } } } } } } }> = [];
  const fakePrisma = {
    shift: {
      findMany: async (query: typeof queries[number]) => {
        queries.push(query);
        assert.equal(query.where.storeId, "store-authorized");
        assert.equal(query.where.status, "CLOSED");
        assert.equal(query.include.lines.include.pack.include.game.select.id, true);
        return shifts;
      },
    },
    $queryRawUnsafe: async (_query: string, storeId: string, ids: string[]) => {
      assert.equal(storeId, "store-authorized");
      assert.deepEqual(ids, shifts.map((item) => item.id));
      return [];
    },
  };
  const database: { prisma: typeof fakePrisma | null } = { prisma: fakePrisma };
  const replacements = [
    { getApiSession: async () => session },
    database,
    { queryInventoryActivity: async () => [] },
  ];
  paths.forEach((path, index) => {
    require.cache[path] = { id: path, filename: path, loaded: true, exports: replacements[index] } as NodeJS.Module;
  });
  context.after(() => {
    paths.forEach((path, index) => {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    });
  });
  const { GET: getReport } = await import("../../app/api/reports/shifts/route");
  const { GET: getExport } = await import("../../app/api/reports/export/route");
  const reportRequest = () => new NextRequest("http://localhost/api/reports/shifts?from=2026-10-01&to=2026-10-02");
  const exportRequest = (type = "games", format = "csv") =>
    new NextRequest(`http://localhost/api/reports/export?type=${type}&format=${format}&from=2026-10-01&to=2026-10-02`);
  const gamesCSV = async () => parseCSV(await (await getExport(exportRequest())).text());
  const shiftsCSV = async () => parseCSV(await (await getExport(exportRequest("shifts"))).text());

  await context.test("authentication and database availability fail before querying", async () => {
    assert.equal((await getReport(reportRequest())).status, 401);
    assert.equal((await getExport(exportRequest())).status, 401);
    assert.equal(queries.length, 0);
    session = { storeId: "store-authorized", storeName: "Store" };
    database.prisma = null;
    assert.equal((await getReport(reportRequest())).status, 503);
    assert.equal((await getExport(exportRequest())).status, 503);
    assert.equal(queries.length, 0);
    database.prisma = fakePrisma;
  });

  await context.test("three-game example is 450 opening / 50 sold / 400 ending / $250 gross / $237.50 cost", async () => {
    const response = await getReport(reportRequest());
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(
      [data.shifts[0].totalTickets, data.shifts[0].ticketsSold, data.shifts[0].activeStock, data.shifts[0].grossSales, data.shifts[0].cogs],
      [450, 50, 400, 250, 237.5],
    );
    assert.equal(data.summary.totalTickets, 50); // Existing field remains tickets sold.
    assert.equal(data.summary.totalOpeningTickets, 450);
    assert.equal(data.summary.activeStock, 400);
    assert.equal(data.summary.stockScope, "SHIFT_TOTALS");
    assert.equal(data.summary.totalNet, 12.5);
    assert.equal(data.shifts[0].packSales.length, 4);
    assert.deepEqual(data.dailyTotals, [{ date: "2026-10-01", grossSales: 250, ticketsSold: 50, shifts: 1 }]);
    assert.equal(data.gamePerformance.length, 3);
    for (const games of [data.shifts[0].gameBreakdown, data.gamePerformance]) {
      assert.deepEqual(games.find((game: { id: string }) => game.id === "game-a"), {
        id: "game-a", gameNumber: "001", name: "Same Name", totalTickets: 150, tickets: 20,
        activeStock: 130, sales: 100, cost: 95,
        ...(games === data.gamePerformance ? { netMargin: 5, marginPct: 5 } : {}),
      });
      assert.equal(games.find((game: { id: string }) => game.id === "game-b").gameNumber, "002");
    }
    assert.deepEqual(queries[0].where.closedAt, {
      gte: new Date("2026-10-01T00:00:00"), lte: new Date("2026-10-02T23:59:59"),
    });

    const csvResponse = await getExport(exportRequest());
    assert.equal(csvResponse.headers.get("Content-Type"), "text/csv; charset=utf-8");
    assert.match(csvResponse.headers.get("Content-Disposition") ?? "", /games_2026-10-01_2026-10-02\.csv/);
    const [headers, ...rows] = parseCSV(await csvResponse.text());
    assert.deepEqual(headers, [
      "Game ID", "Game #", "Game Name", "Opening Total Tickets (shift-scoped)", "Tickets Sold",
      "Ending Active Stock (shift-scoped)", "Gross Sales 100% ($)", "Cost 95% ($)", "Net Margin ($)", "Margin %",
    ]);
    assert.deepEqual(rows.find((row) => row[0] === "game-a"), ["game-a", "001", "Same Name", "150", "20", "130", "100.00", "95.00", "5.00", "5.0"]);
    assert.deepEqual(rows.find((row) => row[0] === "game-b")?.slice(0, 6), ["game-b", "002", "Same Name", "100", "10", "90"]);
    assert.equal(rows.find((row) => row[0] === "game-c")?.[2], 'Third, "Game"');
    assert.deepEqual(rows.at(-1), ["", "", "Total (shift-scoped)", "450", "50", "400", "250.00", "237.50", "12.50", "5.0"]);
    const [shiftHeaders, shiftRow] = await shiftsCSV();
    assert.deepEqual(shiftHeaders.slice(5), headers.slice(3));
    assert.deepEqual(shiftRow.slice(5), ["450", "50", "400", "250.00", "237.50", "12.50", "5.0"]);
  });

  await context.test("repeated packs across shifts are summed, not mistaken for current stock", async () => {
    shifts = [example, shift("shift-two", [line("game-a", "001", 90, 5, "25.00", 85)])];
    const data = await (await getReport(reportRequest())).json();
    const game = data.gamePerformance.find((item: { id: string }) => item.id === "game-a");
    assert.deepEqual([game.totalTickets, game.tickets, game.activeStock, game.sales, game.cost], [240, 25, 215, 125, 118.75]);
    assert.deepEqual([data.summary.totalOpeningTickets, data.summary.totalTickets, data.summary.activeStock], [540, 55, 485]);
    assert.equal(data.summary.totalCogs, 261.25);
    const rows = await gamesCSV();
    assert.deepEqual(rows.find((row) => row[0] === "game-a")?.slice(3, 8), ["240", "25", "215", "125.00", "118.75"]);
    assert.deepEqual(rows.at(-1)?.slice(3, 8), ["540", "55", "485", "275.00", "261.25"]);
  });

  await context.test("unknown endings propagate only through the affected game and containing totals", async () => {
    shifts = [example, shift("missing-ending", [
      line("game-a", "001", 25, 0, "0", null),
      line("game-a", "001", 10, 10, "50", 0),
      line("game-b", "002", 5, 5, "25", 0),
    ])];
    const data = await (await getReport(reportRequest())).json();
    assert.equal(data.shifts[1].activeStock, null);
    assert.equal(data.shifts[0].activeStock, 400);
    assert.equal(data.summary.activeStock, null);
    assert.equal(data.gamePerformance.find((game: { id: string }) => game.id === "game-a").activeStock, null);
    assert.equal(data.gamePerformance.find((game: { id: string }) => game.id === "game-b").activeStock, 90);
    assert.equal(data.shifts[1].gameBreakdown.find((game: { id: string }) => game.id === "game-b").activeStock, 0);
    const rows = await gamesCSV();
    assert.equal(rows.find((row) => row[0] === "game-a")?.[5], "");
    assert.equal(rows.at(-1)?.[5], "");
    const shiftRows = await shiftsCSV();
    assert.equal(shiftRows[2][7], "");
  });

  await context.test("cost rounds once from aggregate finalized gross, not rounded line costs or game prices", async () => {
    shifts = ["one", "two", "three"].map((id) => shift(id, [line("game-a", "001", 1, 1, "0.10", 0)]));
    const data = await (await getReport(reportRequest())).json();
    assert.equal(data.summary.totalGross, 0.3);
    assert.equal(data.summary.totalCogs, 0.29);
    assert.equal(data.summary.totalNet, 0.01);
    assert.equal(data.gamePerformance[0].cost, 0.29);
    const rows = await gamesCSV();
    assert.deepEqual(rows[1].slice(6, 9), ["0.30", "0.29", "0.01"]);
    assert.deepEqual(rows.at(-1)?.slice(6, 9), ["0.30", "0.29", "0.01"]);
    shifts = [shift("one", [
      line("game-a", "001", 1, 1, "0.10", 0),
      line("game-a", "001", 1, 1, "0.10", 0),
      line("game-a", "001", 1, 1, "0.10", 0),
    ])];
    const sameShift = await (await getReport(reportRequest())).json();
    assert.equal(sameShift.shifts[0].cogs, 0.29);
    assert.equal(sameShift.shifts[0].gameBreakdown[0].cost, 0.29);
    assert.deepEqual((await shiftsCSV())[1].slice(8, 11), ["0.30", "0.29", "0.01"]);
  });

  await context.test("zero sales, empty shifts, and no shifts retain zero totals", async () => {
    shifts = [shift("zero", [line("game-a", "001", 12, 0, "0", 12)]), shift("empty", [])];
    const data = await (await getReport(reportRequest())).json();
    assert.deepEqual([data.shifts[1].totalTickets, data.shifts[1].activeStock, data.shifts[1].cogs], [0, 0, 0]);
    assert.equal(data.gamePerformance[0].marginPct, 0);
    assert.deepEqual((await gamesCSV())[1].slice(3), ["12", "0", "12", "0.00", "0.00", "0.00", "0.0"]);
    shifts = [];
    const empty = await (await getReport(reportRequest())).json();
    assert.deepEqual(empty.gamePerformance, []);
    assert.equal(empty.summary.totalOpeningTickets, 0);
    assert.equal(empty.summary.activeStock, 0);
    assert.deepEqual((await gamesCSV())[1], ["", "", "Total (shift-scoped)", "0", "0", "0", "0.00", "0.00", "0.00", "0.0"]);
  });

  await context.test("API and CSV totals round their own gross even when rounded game costs sum differently", async () => {
    shifts = [shift("rounding", ["game-a", "game-b", "game-c"].map((id, index) =>
      line(id, String(index + 1), 1, 1, "0.10", 0)))];
    const data = await (await getReport(reportRequest())).json();
    assert.equal(data.shifts[0].cogs, 0.29);
    assert.equal(data.summary.totalCogs, 0.29);
    assert.equal(data.shifts[0].netMargin, 0.01);
    assert.equal(data.summary.totalNet, 0.01);
    assert.deepEqual(data.shifts[0].gameBreakdown.map((game: { cost: number }) => game.cost), [0.1, 0.1, 0.1]);
    assert.deepEqual(data.gamePerformance.map((game: { cost: number }) => game.cost), [0.1, 0.1, 0.1]);
    const rows = await gamesCSV();
    assert.deepEqual(rows.slice(1, -1).map((row) => row[7]), ["0.10", "0.10", "0.10"]);
    assert.deepEqual(rows.at(-1)?.slice(6, 9), ["0.30", "0.29", "0.01"]);
    assert.deepEqual((await shiftsCSV())[1].slice(8, 11), ["0.30", "0.29", "0.01"]);
  });

  await context.test("existing PDF behavior is preserved", async () => {
    shifts = [example];
    const response = await getExport(exportRequest("shifts", "pdf"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "application/pdf");
    assert.match(response.headers.get("Content-Disposition") ?? "", /shifts_2026-10-01\.pdf/);
    const pdf = await response.text();
    assert.ok(pdf.startsWith("%PDF-1.4"));
    assert.match(pdf, /Tickets: 50 \| Sales: \$250\.00/);
    assert.equal((await getExport(exportRequest("games", "pdf"))).status, 400);
    assert.equal((await getExport(exportRequest("activity", "pdf"))).headers.get("Content-Type"), "application/pdf");
  });
});
