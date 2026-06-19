import { Pack } from "@/lib/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { getGame, formatCurrency, formatDate } from "@/lib/utils";
import { MoveRight } from "lucide-react";

export function PackRow({ pack }: { pack: Pack }) {
  const game = getGame(pack.gameId);
  if (!game) return null;

  return (
    <div className="group relative">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-6 px-5 py-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs text-text-tertiary">
              #{game.gameNumber}
            </span>
            <p className="text-sm font-medium text-text">{game.name}</p>
          </div>
          <p className="mt-1 font-mono text-xs text-text-secondary">
            {pack.serialNumber}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm text-text">{formatCurrency(game.price)}</p>
          <p className="text-xs text-text-tertiary">per ticket</p>
        </div>

        <div className="text-right">
          <p className="font-mono text-sm text-text">
            {formatCurrency(pack.retailValue)}
          </p>
          <p className="text-xs text-text-tertiary">retail value</p>
        </div>

        <div className="text-right">
          <p className="text-sm text-text-secondary">{formatDate(pack.receivedAt)}</p>
          <p className="text-xs text-text-tertiary">{pack.receivedBy}</p>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={pack.status} />
          {pack.status === "back-stock" && (
            <Button variant="primary" size="sm">
              Activate
              <MoveRight size={13} />
            </Button>
          )}
        </div>
      </div>
      <div className="perf-divider mx-5" />
    </div>
  );
}
