import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { GameSyncService } from "@/lib/games-sync/game-sync-service";
import { PrismaGameRepository } from "@/lib/games-sync/game-repository";
import { SyncJob } from "@/lib/games-sync/sync-job";

const syncJob = new SyncJob(
  new GameSyncService({
    repository: new PrismaGameRepository(prisma),
  })
);

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role === "VIEWER") {
    return NextResponse.json(
      { error: "You don't have permission to sync games." },
      { status: 403 }
    );
  }

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requestedStoreId =
      typeof body.storeId === "string" && body.storeId.trim()
        ? body.storeId.trim()
        : session.storeId;

    if (requestedStoreId !== session.storeId && session.role !== "MANAGER") {
      return NextResponse.json(
        { error: "You can only sync your own store." },
        { status: 403 }
      );
    }

    const result = await syncJob.run(requestedStoreId);
    if (!result.accepted) {
      return NextResponse.json(
        { error: "Sync already in progress for this store. Please wait." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      summary: result.summary,
    });
  } catch (err) {
    console.error("[POST /api/games/sync]", err);
    return NextResponse.json({ error: "Failed to sync games." }, { status: 500 });
  }
}

