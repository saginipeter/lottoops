import { ClassifiedGame, SyncRunSummary } from "@/lib/games-sync/types";

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function syntheticDrawNumber(name: string): string {
  const normalized = name.toUpperCase().replace(/[^A-Z0-9]+/g, "");
  const body = normalized.slice(0, 20) || "DRAW";
  return `DRAW-${body}`;
}

export interface GameRepository {
  ensureSchema(): Promise<void>;
  upsertGame(storeId: string, game: ClassifiedGame): Promise<void>;
  enqueueManualReview(
    storeId: string,
    game: ClassifiedGame,
    reason: string
  ): Promise<void>;
  writeSyncLog(summary: SyncRunSummary): Promise<void>;
}

export class PrismaGameRepository implements GameRepository {
  constructor(private readonly prismaClient: any) {}

  async ensureSchema(): Promise<void> {
    await this.prismaClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS game_catalog (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        external_key TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        name TEXT NOT NULL,
        game_type TEXT NOT NULL,
        status TEXT NOT NULL,
        source_url TEXT NOT NULL,
        source_type TEXT NOT NULL,
        last_synced_at TIMESTAMPTZ NOT NULL,
        game_number TEXT,
        ticket_price DOUBLE PRECISION,
        odds TEXT,
        top_prize TEXT,
        prizes_claimed INTEGER,
        remaining_top_prizes INTEGER,
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        draw_days JSONB,
        draw_times JSONB,
        sales_cutoff TEXT,
        broadcast_time TEXT,
        next_draw_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(store_id, external_key)
      );
    `);

    await this.prismaClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS game_sync_logs (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ NOT NULL,
        processed INTEGER NOT NULL,
        created_or_updated INTEGER NOT NULL,
        unknown_count INTEGER NOT NULL,
        source_failures JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.prismaClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS game_manual_review_queue (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        external_key TEXT NOT NULL,
        game_name TEXT NOT NULL,
        reason TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        UNIQUE(store_id, external_key)
      );
    `);
  }

  async upsertGame(storeId: string, game: ClassifiedGame): Promise<void> {
    const gameNumber = game.gameNumber ?? syntheticDrawNumber(game.name);
    const isActive = game.status === "active" || game.status === "closing";
    const normalizedName = normalizeName(game.name);
    const nowIso = new Date().toISOString();

    await this.prismaClient.$executeRawUnsafe(
      `
      INSERT INTO game_catalog (
        id, store_id, external_key, normalized_name, name, game_type, status,
        source_url, source_type, last_synced_at, game_number, ticket_price,
        odds, top_prize, prizes_claimed, remaining_top_prizes, start_date, end_date,
        draw_days, draw_times, sales_cutoff, broadcast_time, next_draw_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,$21,$22,$23,$24
      )
      ON CONFLICT (store_id, external_key)
      DO UPDATE SET
        normalized_name = EXCLUDED.normalized_name,
        name = EXCLUDED.name,
        game_type = EXCLUDED.game_type,
        status = EXCLUDED.status,
        source_url = EXCLUDED.source_url,
        source_type = EXCLUDED.source_type,
        last_synced_at = EXCLUDED.last_synced_at,
        game_number = EXCLUDED.game_number,
        ticket_price = EXCLUDED.ticket_price,
        odds = EXCLUDED.odds,
        top_prize = EXCLUDED.top_prize,
        prizes_claimed = EXCLUDED.prizes_claimed,
        remaining_top_prizes = EXCLUDED.remaining_top_prizes,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        draw_days = EXCLUDED.draw_days,
        draw_times = EXCLUDED.draw_times,
        sales_cutoff = EXCLUDED.sales_cutoff,
        broadcast_time = EXCLUDED.broadcast_time,
        next_draw_at = EXCLUDED.next_draw_at,
        updated_at = EXCLUDED.updated_at
      `,
      makeId("gc"),
      storeId,
      game.externalId,
      normalizedName,
      game.name,
      game.gameType,
      game.status,
      game.sourceUrl,
      game.sourceType,
      nowIso,
      game.gameNumber ?? null,
      game.price ?? null,
      game.odds ?? null,
      game.topPrize ?? null,
      game.prizesClaimed ?? null,
      game.remainingTopPrizes ?? null,
      game.startDate?.toISOString() ?? null,
      game.endDate?.toISOString() ?? null,
      JSON.stringify(game.drawDays ?? []),
      JSON.stringify(game.drawTimes ?? []),
      game.salesCutoff ?? null,
      game.broadcastTime ?? null,
      game.nextDrawAt?.toISOString() ?? null,
      nowIso
    );

    await this.prismaClient.game.upsert({
      where: {
        storeId_gameNumber: {
          storeId,
          gameNumber,
        },
      },
      create: {
        storeId,
        gameNumber,
        name: game.name,
        price: game.price ?? 0.01,
        ticketsPerPack: game.gameType === "scratch_off" ? 150 : 1,
        active: isActive,
      },
      update: {
        name: game.name,
        price: game.price ?? undefined,
        active: isActive,
      },
    });
  }

  async enqueueManualReview(
    storeId: string,
    game: ClassifiedGame,
    reason: string
  ): Promise<void> {
    await this.prismaClient.$executeRawUnsafe(
      `
      INSERT INTO game_manual_review_queue (
        id, store_id, external_key, game_name, reason, payload
      )
      VALUES ($1,$2,$3,$4,$5,$6::jsonb)
      ON CONFLICT (store_id, external_key)
      DO UPDATE SET
        game_name = EXCLUDED.game_name,
        reason = EXCLUDED.reason,
        payload = EXCLUDED.payload
      `,
      makeId("gr"),
      storeId,
      game.externalId,
      game.name,
      reason,
      JSON.stringify(game)
    );
  }

  async writeSyncLog(summary: SyncRunSummary): Promise<void> {
    await this.prismaClient.$executeRawUnsafe(
      `
      INSERT INTO game_sync_logs (
        id, store_id, started_at, completed_at, processed,
        created_or_updated, unknown_count, source_failures
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
      `,
      makeId("gsl"),
      summary.storeId,
      summary.startedAt.toISOString(),
      summary.completedAt.toISOString(),
      summary.processed,
      summary.createdOrUpdated,
      summary.unknownCount,
      JSON.stringify(summary.sourceFailures)
    );
  }
}

export class InMemoryGameRepository implements GameRepository {
  private catalog = new Map<string, ClassifiedGame>();
  private manualReview = new Map<string, ClassifiedGame>();
  private logs: SyncRunSummary[] = [];

  async ensureSchema(): Promise<void> {}

  async upsertGame(storeId: string, game: ClassifiedGame): Promise<void> {
    this.catalog.set(`${storeId}:${game.externalId}`, game);
  }

  async enqueueManualReview(
    storeId: string,
    game: ClassifiedGame
  ): Promise<void> {
    this.manualReview.set(`${storeId}:${game.externalId}`, game);
  }

  async writeSyncLog(summary: SyncRunSummary): Promise<void> {
    this.logs.push(summary);
  }

  getCatalogCount(storeId: string): number {
    return Array.from(this.catalog.keys()).filter((key) =>
      key.startsWith(`${storeId}:`)
    ).length;
  }

  getManualReviewCount(storeId: string): number {
    return Array.from(this.manualReview.keys()).filter((key) =>
      key.startsWith(`${storeId}:`)
    ).length;
  }

  getLogs(): SyncRunSummary[] {
    return this.logs;
  }
}

