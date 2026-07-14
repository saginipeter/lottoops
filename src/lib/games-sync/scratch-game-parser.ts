import { NormalizedSourceGame } from "@/lib/games-sync/types";

const SCRATCH_SOURCE_URL =
  "https://www.texaslottery.com/export/sites/lottery/Games/Scratch_Offs/scratchoff.csv";

interface ScratchAggregate {
  gameNumber: string;
  gameName: string;
  ticketPrice?: number;
  gameCloseDate?: Date;
  topPrizeValue?: number;
  topPrizeLabel?: string;
  topPrizePrinted?: number;
  topPrizeClaimed?: number;
  totalClaimed?: number;
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
  return values.map((value) => value.trim());
}

function parseDateFromTexas(value: string): Date | undefined {
  if (!value) return undefined;
  const [month, day, year] = value.split("/");
  if (!month || !day || !year) return undefined;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function prizeLevelToNumber(prizeLevel: string): number | undefined {
  if (!prizeLevel || prizeLevel.toUpperCase() === "TOTAL") {
    return undefined;
  }
  const normalized = prizeLevel.replace(/[$,]/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

export class ScratchGameParser {
  parse(csvText: string): NormalizedSourceGame[] {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 3) return [];

    const rows = lines.slice(2);
    const byGameNumber = new Map<string, ScratchAggregate>();

    for (const row of rows) {
      const cols = parseCsvLine(row);
      if (cols.length < 7) continue;

      const gameNumber = cols[0];
      const gameName = cols[1];
      const gameCloseDate = parseDateFromTexas(cols[2]);
      const ticketPrice = Number(cols[3]);
      const prizeLevel = cols[4];
      const totalPrizes = Number(cols[5]);
      const prizesClaimed = Number(cols[6]);

      if (!gameNumber || !gameName) continue;

      const existing = byGameNumber.get(gameNumber) ?? {
        gameNumber,
        gameName,
      };

      existing.gameName = gameName;
      if (Number.isFinite(ticketPrice)) {
        existing.ticketPrice = ticketPrice;
      }
      if (gameCloseDate) {
        existing.gameCloseDate = gameCloseDate;
      }

      if (prizeLevel.toUpperCase() === "TOTAL") {
        if (Number.isFinite(prizesClaimed)) {
          existing.totalClaimed = prizesClaimed;
        }
      } else {
        const prizeLevelValue = prizeLevelToNumber(prizeLevel);
        if (
          prizeLevelValue !== undefined &&
          (existing.topPrizeValue === undefined || prizeLevelValue > existing.topPrizeValue)
        ) {
          existing.topPrizeValue = prizeLevelValue;
          existing.topPrizeLabel = prizeLevel;
          existing.topPrizePrinted = Number.isFinite(totalPrizes) ? totalPrizes : undefined;
          existing.topPrizeClaimed = Number.isFinite(prizesClaimed)
            ? prizesClaimed
            : undefined;
        }
      }

      byGameNumber.set(gameNumber, existing);
    }

    return Array.from(byGameNumber.values()).map((game) => {
      const remainingTopPrizes =
        game.topPrizePrinted !== undefined && game.topPrizeClaimed !== undefined
          ? Math.max(game.topPrizePrinted - game.topPrizeClaimed, 0)
          : undefined;

      return {
        externalId: `scratch:${game.gameNumber}`,
        name: game.gameName,
        sourceUrl: SCRATCH_SOURCE_URL,
        sourceType: "scratch_offs",
        gameNumber: game.gameNumber,
        price: game.ticketPrice,
        topPrize: game.topPrizeLabel,
        prizesClaimed: game.totalClaimed,
        remainingTopPrizes,
        endDate: game.gameCloseDate,
      };
    });
  }
}

export const texasScratchSourceUrl = SCRATCH_SOURCE_URL;

