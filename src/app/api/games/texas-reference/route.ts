import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";

const TEXAS_SCRATCH_CSV_URL =
  "https://www.texaslottery.com/export/sites/lottery/Games/Scratch_Offs/scratchoff.csv";

interface TexasGameReference {
  gameNumber: string;
  gameName: string;
  ticketPrice: number;
  gameCloseDate: string | null;
  sourceUrl: string;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((v) => v.trim());
}

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const gameNumber = req.nextUrl.searchParams.get("gameNumber")?.trim() ?? "";
  if (!gameNumber) {
    return NextResponse.json({ error: "gameNumber is required." }, { status: 400 });
  }

  try {
    const response = await fetch(TEXAS_SCRATCH_CSV_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to reach Texas Lottery reference data." },
        { status: 502 }
      );
    }

    const csv = await response.text();
    const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 3) {
      return NextResponse.json(
        { error: "Texas Lottery reference data is unavailable right now." },
        { status: 502 }
      );
    }

    // Row 1 is title, row 2 is header.
    const rows = lines.slice(2);
    let match: TexasGameReference | null = null;

    for (const row of rows) {
      const values = parseCsvLine(row);
      if (values.length < 4) {
        continue;
      }

      const rowGameNumber = values[0];
      if (rowGameNumber !== gameNumber) {
        continue;
      }

      const rowName = values[1];
      const rowCloseDate = values[2] || null;
      const rowTicketPrice = Number(values[3]);
      if (!Number.isFinite(rowTicketPrice)) {
        continue;
      }

      match = {
        gameNumber: rowGameNumber,
        gameName: rowName,
        ticketPrice: rowTicketPrice,
        gameCloseDate: rowCloseDate,
        sourceUrl: TEXAS_SCRATCH_CSV_URL,
      };
      break;
    }

    return NextResponse.json({
      found: Boolean(match),
      reference: match,
    });
  } catch (err) {
    console.error("[GET /api/games/texas-reference]", err);
    return NextResponse.json(
      { error: "Failed to load Texas Lottery reference." },
      { status: 500 }
    );
  }
}
