import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { GameSyncService } from "@/lib/games-sync/game-sync-service";
import { PrismaGameRepository } from "@/lib/games-sync/game-repository";
import { SyncJob } from "@/lib/games-sync/sync-job";

// Per-store sync jobs keyed by storeId so concurrent requests for the same
// store are deduplicated but different stores run independently.
const syncJobs = new Map<string, SyncJob>();

function getSyncJob(storeId: string): SyncJob | null {
  if (!prisma) return null;
  if (!syncJobs.has(storeId)) {
    syncJobs.set(
      storeId,
      new SyncJob(
        new GameSyncService({
          repository: new PrismaGameRepository(prisma),
        })
      )
    );
  }
  return syncJobs.get(storeId)!;
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role === "SHIFT_LEAD" || session.role === "EMPLOYEE") {
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

    // Resolve the store from the DB user record so we always use the real
    // storeId even if the session cookie was created while offline (mock storeId).
    let resolvedStoreId = requestedStoreId;
    const dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { storeId: true },
    });
    if (dbUser?.storeId) {
      resolvedStoreId = dbUser.storeId;
    } else {
      // Fall back to session storeId and verify it exists.
      const store = await prisma.store.findUnique({
        where: { id: requestedStoreId },
        select: { id: true },
      });
      if (!store) {
        return NextResponse.json(
          { error: "Store not found. Ensure your account is linked to a store." },
          { status: 400 }
        );
      }
    }

    const job = getSyncJob(resolvedStoreId);
    if (!job) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    const result = await job.run(resolvedStoreId);
    if (!result.accepted) {
      return NextResponse.json(
        { error: "Sync already in progress for this store. Please wait and try again." },
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

