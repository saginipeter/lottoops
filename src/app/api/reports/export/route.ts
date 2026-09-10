import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { queryInventoryActivity } from "@/lib/activity-log";

function escapeCSV(val: unknown): string {
  const str = val === null || val === undefined ? "" : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSV(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCSV).join(",")];
  for (const row of rows) lines.push(row.map(escapeCSV).join(","));
  return lines.join("\r\n");
}

function pdfText(value: unknown): string {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(title: string, subtitle: string, rows: string[]): Buffer {
  const lines = [title, subtitle, "", ...rows].flatMap((line) => {
    const text = String(line);
    return text.length <= 105 ? [text] : text.match(/.{1,105}(?:\s|$)/g)?.map((part) => part.trimEnd()) ?? [text.slice(0, 105)];
  });
  const content = ["BT", "/F1 9 Tf", "45 760 Td", ...lines.flatMap((line, index) => [index === 0 ? "/F1 14 Tf" : index === 1 ? "/F1 9 Tf" : "/F1 8 Tf", `(${pdfText(line)}) Tj`, "0 -14 Td"]), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}

// GET /api/reports/export?type=shifts|games|inventory|activity&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "shifts";
  const format = searchParams.get("format") ?? "csv";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const toDate = toParam ? new Date(toParam + "T23:59:59") : new Date();
  const fromDate = fromParam
    ? new Date(fromParam + "T00:00:00")
    : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const shifts = await prisma.shift.findMany({
    where: {
      storeId: session.storeId,
      status: "CLOSED",
      closedAt: { gte: fromDate, lte: toDate },
    },
    include: {
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      lines: {
        include: {
          pack: {
            include: {
              game: { select: { name: true, gameNumber: true, price: true } },
            },
          },
        },
      },
    },
    orderBy: { closedAt: "desc" },
  });

  let csv = "";
  let filename = "";

  if (type === "shifts") {
    const headers = [
      "Shift ID", "Opened At", "Closed At", "Opened By", "Closed By",
      "Tickets Sold", "Gross Sales ($)", "Est. COGS ($)", "Net Margin ($)", "Margin %",
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (shifts as any[]).map((shift) => {
      let gross = 0, cogs = 0, tickets = 0;
      for (const line of shift.lines) {
        const sold = Number(line.ticketsSold ?? 0);
        const sales = Number(line.salesAmount ?? 0);
        gross += sales;
        cogs += sold * Number(line.pack.game.price) * 0.7;
        tickets += sold;
      }
      const net = gross - cogs;
      return [
        shift.id,
        shift.openedAt.toISOString(),
        shift.closedAt?.toISOString() ?? "",
        shift.openedBy.name,
        shift.closedBy?.name ?? "",
        tickets,
        gross.toFixed(2),
        cogs.toFixed(2),
        net.toFixed(2),
        gross > 0 ? ((net / gross) * 100).toFixed(1) : "0.0",
      ];
    });
    csv = buildCSV(headers, rows);
    filename = `shifts_${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}.csv`;
  } else if (type === "games") {
    // Per-game performance across date range
    const gameMap = new Map<string, { gameNumber: string; name: string; tickets: number; sales: number; cost: number }>();
    for (const shift of shifts) {
      for (const line of shift.lines) {
        const key = line.pack.game.name;
        const existing = gameMap.get(key) ?? {
          gameNumber: line.pack.game.gameNumber ?? "",
          name: line.pack.game.name,
          tickets: 0,
          sales: 0,
          cost: 0,
        };
        existing.tickets += Number(line.ticketsSold ?? 0);
        existing.sales += Number(line.salesAmount ?? 0);
        existing.cost += Number(line.ticketsSold ?? 0) * Number(line.pack.game.price) * 0.7;
        gameMap.set(key, existing);
      }
    }
    const headers = ["Game #", "Game Name", "Tickets Sold", "Gross Sales ($)", "Est. COGS ($)", "Net Margin ($)", "Margin %"];
    const rows = Array.from(gameMap.values())
      .sort((a, b) => b.sales - a.sales)
      .map((g) => {
        const net = g.sales - g.cost;
        return [
          g.gameNumber,
          g.name,
          g.tickets,
          g.sales.toFixed(2),
          g.cost.toFixed(2),
          net.toFixed(2),
          g.sales > 0 ? ((net / g.sales) * 100).toFixed(1) : "0.0",
        ];
      });
    csv = buildCSV(headers, rows);
    filename = `games_${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}.csv`;
  } else if (type === "inventory") {
    // Current inventory snapshot
    const packs = await prisma.pack.findMany({
      where: { storeId: session.storeId },
      include: { game: { select: { name: true, gameNumber: true, price: true } } },
      orderBy: { receivedAt: "desc" },
    });
    const headers = ["Pack ID", "Serial #", "Game #", "Game Name", "Status", "Ticket Price ($)", "Qty", "Cost ($)", "Retail Value ($)", "Received At"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (packs as any[]).map((p) => [
      p.id, p.serialNumber, p.game.gameNumber, p.game.name, p.status,
      Number(p.ticketPrice ?? p.game.price).toFixed(2),
      p.ticketQuantity ?? "",
      Number(p.cost).toFixed(2),
      Number(p.retailValue).toFixed(2),
      p.receivedAt.toISOString(),
    ]);
    csv = buildCSV(headers, rows);
    filename = `inventory_${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (type === "activity") {
    const logs = await queryInventoryActivity(session.storeId, {
      from: fromDate,
      to: toDate,
      limit: 2000,
    });
    const headers = ["Timestamp", "Action", "Entity", "Entity ID", "Detail", "Performed By"];
    const rows = logs.map((row: unknown) => {
      const entry = row as {
        createdAt: Date | string;
        action: string;
        entityType: string;
        entityId: string | null;
        detail: string;
        performedByName: string | null;
        performedById: string;
      };
      return [
        new Date(entry.createdAt).toISOString(),
        entry.action,
        entry.entityType,
        entry.entityId ?? "",
        entry.detail,
        entry.performedByName ?? entry.performedById,
      ];
    });
    csv = buildCSV(headers, rows);
    filename = `activity_${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}.csv`;
  } else {
    return NextResponse.json({ error: "Invalid export type. Use: shifts, games, inventory, activity" }, { status: 400 });
  }

  if (format === "pdf") {
    if (type === "shifts") {
      const rows = (shifts as any[]).flatMap((shift) => {
        const tickets = shift.lines.reduce((sum: number, line: any) => sum + Number(line.ticketsSold ?? 0), 0);
        const sales = shift.lines.reduce((sum: number, line: any) => sum + Number(line.salesAmount ?? 0), 0);
        return [`${shift.openedAt.toISOString()} | ${shift.openedBy.name} -> ${shift.closedBy?.name ?? ""}`, `Tickets: ${tickets} | Sales: $${sales.toFixed(2)}`, ""];
      });
      const pdf = buildSimplePdf("LottoOps Shift Report", `${fromDate.toISOString().slice(0, 10)} through ${toDate.toISOString().slice(0, 10)}`, rows);
      return new NextResponse(pdf as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="shifts_${fromDate.toISOString().slice(0, 10)}.pdf"` } });
    }
    if (type === "activity") {
      const logs = await queryInventoryActivity(session.storeId, { from: fromDate, to: toDate, limit: 2000 });
      const rows = logs.map((entry: any) => `${new Date(entry.createdAt).toISOString()} | ${entry.action} | ${entry.performedByName ?? entry.performedById} | ${entry.detail}`);
      const pdf = buildSimplePdf("LottoOps Activity Log", `${fromDate.toISOString().slice(0, 10)} through ${toDate.toISOString().slice(0, 10)}`, rows);
      return new NextResponse(pdf as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="activity_${fromDate.toISOString().slice(0, 10)}.pdf"` } });
    }
    return NextResponse.json({ error: "PDF is available for shifts and activity reports." }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
