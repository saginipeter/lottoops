import { GameType, NormalizedSourceGame } from "@/lib/games-sync/types";

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

export function classifyGame(input: {
  name: string;
  sourceType?: string;
  gameNumber?: string;
  price?: number;
  odds?: string;
  topPrize?: string;
  drawDays?: string[];
  drawTimes?: string[];
  salesCutoff?: string;
}): GameType {
  if (input.sourceType === "scratch_offs") return "scratch_off";

  if (input.gameNumber || input.price || input.odds || input.topPrize) {
    return "scratch_off";
  }

  if (input.drawDays?.length || input.drawTimes?.length || input.salesCutoff) {
    return "draw_game";
  }

  const normalizedName = input.name.trim().toLowerCase();
  const isKnownDraw = KNOWN_DRAW_GAMES.some(
    (name) => normalizedName === name.toLowerCase()
  );

  if (isKnownDraw) return "draw_game";

  return "unknown";
}

export class GameClassifier {
  classify(input: NormalizedSourceGame): GameType {
    return classifyGame({
      name: input.name,
      sourceType: input.sourceType,
      gameNumber: input.gameNumber,
      price: input.price,
      odds: input.odds,
      topPrize: input.topPrize,
      drawDays: input.drawDays,
      drawTimes: input.drawTimes,
      salesCutoff: input.salesCutoff,
    });
  }
}

