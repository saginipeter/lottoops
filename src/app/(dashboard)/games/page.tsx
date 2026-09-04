import { Header } from "@/components/layout/header";
import { GamesManager } from "@/components/games/games-manager";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";

export default async function GamesPage() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Games" subtitle="Not authenticated" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-lg border-2 border-dashed border-red-300 bg-red-50 p-6 text-center">
            <p className="font-medium text-red-600">Not authenticated</p>
          </div>
        </div>
      </div>
    );
  }

  if (!prisma) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Games" subtitle="Database unavailable" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-lg border-2 border-dashed border-yellow-300 bg-yellow-50 p-6 text-center">
            <p className="font-medium text-yellow-800">Database not connected</p>
          </div>
        </div>
      </div>
    );
  }

  const games = await prisma.game.findMany({
    where: { storeId: session.storeId },
    orderBy: { gameNumber: "asc" },
  });
  const gameData = games.map((game: any) => ({
    ...game,
    price: Number(game.price),
    updatedAt: game.updatedAt.toISOString(),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title="Games"
        subtitle="Manage the Lottery Scratch_off Management System game catalog"
      />

      <PageToolbar
        left={<span className="text-xs text-text-secondary">Catalog Size: {gameData.length}</span>}
        center={<span>Ctrl+F Search | Ctrl+S Save</span>}
        right={<span className="text-xs text-text-tertiary">Role: {session.role}</span>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <GamesManager initialGames={gameData} userRole={session.role} />
      </div>

      <StatusBar
        left={<span>Games Loaded: {gameData.length}</span>}
        center={<span>Use sync tools for catalog updates</span>}
        right={<span>Store scoped</span>}
      />
    </div>
  );
}
