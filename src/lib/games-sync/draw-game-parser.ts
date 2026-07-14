import { NormalizedSourceGame } from "@/lib/games-sync/types";

const DRAW_SOURCE_URL =
  "https://www.texaslottery.com/export/sites/lottery/Games/Drawing_Schedule/index.html";

const KNOWN_DRAW_GAMES = [
  "Powerball",
  "Mega Millions",
  "Lotto Texas",
  "Texas Two Step",
  "All or Nothing",
  "Pick 3",
  "Daily 4",
  "Cash 5",
  "Texas Free Lottery",
];

const DAYS_PATTERN =
  /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s*(?:,|and)\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))*/gi;
const TIME_PATTERN = /\b\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)\b/gi;

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

export class DrawGameParser {
  parse(html: string): NormalizedSourceGame[] {
    const parsed: NormalizedSourceGame[] = [];
    const normalizedHtml = html.replace(/\s+/g, " ");

    for (const gameName of KNOWN_DRAW_GAMES) {
      const idx = normalizedHtml.toLowerCase().indexOf(gameName.toLowerCase());
      if (idx === -1) {
        continue;
      }

      const windowStart = Math.max(idx - 250, 0);
      const windowEnd = Math.min(idx + 450, normalizedHtml.length);
      const context = normalizedHtml.slice(windowStart, windowEnd);

      const dayMatches = context.match(DAYS_PATTERN) ?? [];
      const timeMatches = context.match(TIME_PATTERN) ?? [];

      const salesCutoffMatch = context.match(
        /(sales(?:\s|-)?cutoff|sales(?:\s|-)?cut-off)[^.;<]{0,80}/i
      );
      const broadcastMatch = context.match(/(broadcast)[^.;<]{0,80}/i);

      parsed.push({
        externalId: `draw:${gameName.toLowerCase().replace(/\s+/g, "_")}`,
        name: gameName,
        sourceUrl: DRAW_SOURCE_URL,
        sourceType: "drawing_schedule",
        drawDays: unique(dayMatches.map((x) => x.trim())),
        drawTimes: unique(timeMatches.map((x) => x.trim())),
        salesCutoff: salesCutoffMatch?.[0]?.trim(),
        broadcastTime: broadcastMatch?.[0]?.trim(),
      });
    }

    return parsed;
  }
}

export const texasDrawSourceUrl = DRAW_SOURCE_URL;

