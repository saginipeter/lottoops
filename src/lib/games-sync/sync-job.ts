import { GameSyncService } from "@/lib/games-sync/game-sync-service";
import { SyncRunSummary } from "@/lib/games-sync/types";

interface SyncJobResult {
  accepted: boolean;
  summary?: SyncRunSummary;
}

export class SyncJob {
  private queue: Promise<void> = Promise.resolve();
  private activeRuns = new Set<string>();

  constructor(private readonly service: GameSyncService) {}

  run(storeId: string): Promise<SyncJobResult> {
    if (this.activeRuns.has(storeId)) {
      return Promise.resolve({ accepted: false });
    }

    return new Promise((resolve) => {
      this.queue = this.queue
        .then(async () => {
          this.activeRuns.add(storeId);
          try {
            const summary = await this.service.syncStore(storeId);
            resolve({
              accepted: true,
              summary,
            });
          } finally {
            this.activeRuns.delete(storeId);
          }
        })
        .catch((err) => {
          console.error("[SyncJob.run]", err);
          resolve({ accepted: false });
          this.activeRuns.delete(storeId);
        });
    });
  }
}

