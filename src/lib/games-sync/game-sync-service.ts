import { DrawGameParser, texasDrawSourceUrl } from "@/lib/games-sync/draw-game-parser";
import { GameClassifier } from "@/lib/games-sync/game-classifier";
import { GameRepository } from "@/lib/games-sync/game-repository";
import { ScratchGameParser, texasScratchSourceUrl } from "@/lib/games-sync/scratch-game-parser";
import { ClassifiedGame, GameStatus, NormalizedSourceGame, SyncRunSummary } from "@/lib/games-sync/types";
import { fetchTexasArtworkIndex, getTexasArtwork } from "@/lib/games-sync/texas-artwork";

interface GameSyncServiceOptions {
  repository: GameRepository;
  classifier?: GameClassifier;
  scratchParser?: ScratchGameParser;
  drawParser?: DrawGameParser;
  fetchImpl?: typeof fetch;
}

function deriveStatus(game: NormalizedSourceGame): GameStatus {
  if (game.endDate) {
    const now = new Date();
    const diffMs = game.endDate.getTime() - now.getTime();
    if (diffMs < 0) return "closed";
    if (diffMs <= 1000 * 60 * 60 * 24 * 45) return "closing";
    return "active";
  }

  if (game.sourceType === "drawing_schedule") return "active";
  if (game.sourceType === "scratch_offs") return "active";
  return "unknown";
}

export class GameSyncService {
  private classifier: GameClassifier;
  private scratchParser: ScratchGameParser;
  private drawParser: DrawGameParser;
  private fetchImpl: typeof fetch;

  constructor(options: GameSyncServiceOptions) {
    this.repository = options.repository;
    this.classifier = options.classifier ?? new GameClassifier();
    this.scratchParser = options.scratchParser ?? new ScratchGameParser();
    this.drawParser = options.drawParser ?? new DrawGameParser();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private repository: GameRepository;

  private async fetchSource(url: string): Promise<string> {
    const res = await this.fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      throw new Error(`Source request failed (${res.status}) for ${url}`);
    }
    return res.text();
  }

  private classify(game: NormalizedSourceGame): ClassifiedGame {
    return {
      ...game,
      gameType: this.classifier.classify(game),
      status: deriveStatus(game),
    };
  }

  async syncStore(storeId: string): Promise<SyncRunSummary> {
    const startedAt = new Date();
    await this.repository.ensureSchema();

    const sourceFailures: SyncRunSummary["sourceFailures"] = [];

    const [scratchResult, drawResult, artworkResult] = await Promise.allSettled([
      this.fetchSource(texasScratchSourceUrl),
      this.fetchSource(texasDrawSourceUrl),
      fetchTexasArtworkIndex(this.fetchImpl),
    ]);

    const normalized: NormalizedSourceGame[] = [];

    if (scratchResult.status === "fulfilled") {
      normalized.push(...this.scratchParser.parse(scratchResult.value));
    } else {
      sourceFailures.push({
        sourceType: "scratch_offs",
        error: scratchResult.reason instanceof Error ? scratchResult.reason.message : String(scratchResult.reason),
      });
    }

    if (drawResult.status === "fulfilled") {
      normalized.push(...this.drawParser.parse(drawResult.value));
    } else {
      sourceFailures.push({
        sourceType: "drawing_schedule",
        error: drawResult.reason instanceof Error ? drawResult.reason.message : String(drawResult.reason),
      });
    }

    if (artworkResult.status === "rejected") {
      sourceFailures.push({
        sourceType: "scratch_offs",
        error: `Artwork catalog: ${artworkResult.reason instanceof Error ? artworkResult.reason.message : String(artworkResult.reason)}`,
      });
    }

    let artworkFound = 0;
    let artworkMissing = 0;
    let artworkUnavailable = 0;
    const scratchGames = normalized.filter(game => game.sourceType === "scratch_offs" && game.gameNumber);
    // One catalog request plus at most six image verification requests in flight.
    // HEAD verifies image MIME type without downloading ticket image binaries into the database.
    for (let offset = 0; offset < scratchGames.length; offset += 6) {
      await Promise.all(scratchGames.slice(offset, offset + 6).map(async game => {
        if (artworkResult.status === "fulfilled") {
          const indexed = artworkResult.value.get(game.gameNumber!)?.imageUrl ?? null;
          game.imageUrl = await getTexasArtwork(game.gameNumber!, this.fetchImpl, indexed);
        } else {
          // A failed source is not evidence that an image is missing. Do not
          // retry the same failed catalog separately for every game.
          game.imageUrl = undefined;
        }
        if (game.imageUrl) artworkFound += 1;
        else if (game.imageUrl === null) artworkMissing += 1;
        else artworkUnavailable += 1;
      }));
    }
    if (artworkUnavailable > 0) {
      sourceFailures.push({ sourceType: "scratch_offs", error: `Artwork verification temporarily unavailable for ${artworkUnavailable} game(s); previously verified images were retained.` });
    }

    let createdOrUpdated = 0;
    let unknownCount = 0;

    for (const rawGame of normalized) {
      const classified = this.classify(rawGame);
      await this.repository.upsertGame(storeId, classified);
      createdOrUpdated += 1;

      if (classified.gameType === "unknown") {
        unknownCount += 1;
        await this.repository.enqueueManualReview(
          storeId,
          classified,
          "Unable to classify from source fields."
        );
      }
    }

    const summary: SyncRunSummary = {
      storeId,
      startedAt,
      completedAt: new Date(),
      processed: normalized.length,
      createdOrUpdated,
      unknownCount,
      artworkFound,
      artworkMissing,
      artworkUnavailable,
      sourceFailures,
    };

    await this.repository.writeSyncLog(summary);
    return summary;
  }
}
