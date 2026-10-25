import { ClassifiedGame, SyncRunSummary } from "@/lib/games-sync/types";

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
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
        image_url TEXT,
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
      ALTER TABLE IF EXISTS game_catalog
      ADD COLUMN IF NOT EXISTS image_url TEXT;
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
    const normalizedName = normalizeName(game.name);
    const nowIso = new Date().toISOString();
    const imageUrl = (game as ClassifiedGame & { imageUrl?: string | null }).imageUrl;
    const hasImageUrl = imageUrl !== undefined;

    // All TIMESTAMPTZ columns need an explicit ::timestamptz cast when
    // passed as text parameters via $executeRawUnsafe — PostgreSQL does not
    // auto-coerce text → timestamptz in parameterized queries.
    await this.prismaClient.$executeRawUnsafe(
      `
      INSERT INTO game_catalog (
        id, store_id, external_key, normalized_name, name, game_type, status,
        source_url, source_type, last_synced_at, game_number, ticket_price,
        image_url, odds, top_prize, prizes_claimed, remaining_top_prizes, start_date, end_date,
        draw_days, draw_times, sales_cutoff, broadcast_time, next_draw_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10::timestamptz,
        $11,$12,$13,$14,$15,$16,$17,
        $18::timestamptz,
        $19::timestamptz,
        $20::jsonb,$21::jsonb,
        $22,$23,
        $24::timestamptz,
        $25::timestamptz
      )
      ON CONFLICT (store_id, external_key)
      DO UPDATE SET
        normalized_name    = EXCLUDED.normalized_name,
        name               = EXCLUDED.name,
        game_type          = EXCLUDED.game_type,
        status             = EXCLUDED.status,
        source_url         = EXCLUDED.source_url,
        source_type        = EXCLUDED.source_type,
        last_synced_at     = EXCLUDED.last_synced_at,
        game_number        = EXCLUDED.game_number,
        ticket_price       = EXCLUDED.ticket_price,
        image_url          = CASE WHEN $26::boolean THEN EXCLUDED.image_url ELSE game_catalog.image_url END,
        odds               = EXCLUDED.odds,
        top_prize          = EXCLUDED.top_prize,
        prizes_claimed     = EXCLUDED.prizes_claimed,
        remaining_top_prizes = EXCLUDED.remaining_top_prizes,
        start_date         = EXCLUDED.start_date,
        end_date           = EXCLUDED.end_date,
        draw_days          = EXCLUDED.draw_days,
        draw_times         = EXCLUDED.draw_times,
        sales_cutoff       = EXCLUDED.sales_cutoff,
        broadcast_time     = EXCLUDED.broadcast_time,
        next_draw_at       = EXCLUDED.next_draw_at,
        updated_at         = EXCLUDED.updated_at
      `,
      makeId("gc"),                           // $1
      storeId,                                // $2
      game.externalId,                        // $3
      normalizedName,                         // $4
      game.name,                              // $5
      game.gameType,                          // $6
      game.status,                            // $7
      game.sourceUrl,                         // $8
      game.sourceType,                        // $9
      nowIso,                                 // $10  → ::timestamptz
      game.gameNumber ?? null,                // $11
      game.price ?? null,                     // $12
      imageUrl ?? null,                       // $13
      game.odds ?? null,                      // $14
      game.topPrize ?? null,                  // $15
      game.prizesClaimed ?? null,             // $16
      game.remainingTopPrizes ?? null,        // $17
      game.startDate?.toISOString() ?? null,  // $18  → ::timestamptz
      game.endDate?.toISOString() ?? null,    // $19  → ::timestamptz
      JSON.stringify(game.drawDays ?? []),    // $20  → ::jsonb
      JSON.stringify(game.drawTimes ?? []),   // $21  → ::jsonb
      game.salesCutoff ?? null,               // $22
      game.broadcastTime ?? null,             // $23
      game.nextDrawAt?.toISOString() ?? null, // $24  → ::timestamptz
      nowIso,                                 // $25  → ::timestamptz  (updated_at)
      hasImageUrl                             // $26 presence flag: undefined preserves existing artwork
    );

    // Sync may refresh artwork for a game that already exists in this store,
    // but must never create a store game or change any other game fields.
    if (game.gameType === "scratch_off" && hasImageUrl && game.gameNumber) {
      await this.prismaClient.game.updateMany({
        where: {
          storeId,
          gameNumber: game.gameNumber,
        },
        data: {
          imageUrl: imageUrl ?? null,
        },
      });
    }
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
      VALUES ($1,$2,$3::timestamptz,$4::timestamptz,$5,$6,$7,$8::jsonb)
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
    const key = `${storeId}:${game.externalId}`;
    const existing = this.catalog.get(key);
    this.catalog.set(key, {
      ...game,
      imageUrl: game.imageUrl === undefined ? existing?.imageUrl : game.imageUrl,
    });
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
