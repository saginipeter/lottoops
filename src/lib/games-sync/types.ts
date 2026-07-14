export type GameType = "scratch_off" | "draw_game" | "unknown";
export type GameStatus = "active" | "closing" | "closed" | "unknown";

export interface GameRecord {
  id: string;
  name: string;
  gameType: GameType;
  status: GameStatus;
  sourceUrl: string;
  sourceType: "scratch_offs" | "drawing_schedule" | "unknown";
  lastSyncedAt: Date;
}

export interface ScratchGameDetails {
  gameId: string;
  gameNumber?: string;
  ticketPrice?: number;
  odds?: string;
  topPrize?: string;
  prizesClaimed?: number;
  remainingTopPrizes?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface DrawGameDetails {
  gameId: string;
  drawDays?: string[];
  drawTimes?: string[];
  salesCutoff?: string;
  broadcastTime?: string;
  nextDrawAt?: Date;
}

export interface NormalizedSourceGame {
  externalId: string;
  name: string;
  sourceUrl: string;
  sourceType: "scratch_offs" | "drawing_schedule" | "unknown";
  gameNumber?: string;
  price?: number;
  odds?: string;
  topPrize?: string;
  prizesClaimed?: number;
  remainingTopPrizes?: number;
  startDate?: Date;
  endDate?: Date;
  drawDays?: string[];
  drawTimes?: string[];
  salesCutoff?: string;
  broadcastTime?: string;
  nextDrawAt?: Date;
}

export interface ClassifiedGame extends NormalizedSourceGame {
  gameType: GameType;
  status: GameStatus;
}

export interface SyncRunSummary {
  storeId: string;
  startedAt: Date;
  completedAt: Date;
  processed: number;
  createdOrUpdated: number;
  unknownCount: number;
  sourceFailures: Array<{
    sourceType: "scratch_offs" | "drawing_schedule";
    error: string;
  }>;
}

