import type { PackWithGame} from "@/lib/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MoveRight } from "lucide-react";

export function PackRow({ pack }: { pack: PackWithGame }) {
  async function activatePack() {
    const res = await fetch("/api/activate-pack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        packId: pack.id,
      }),
    });

    if (res.ok) {
      window.location.reload();
    } else {
      alert("Unable to activate pack.");
    }
  }

  return (
    <div className="group relative">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-6 px-5 py-4">

        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs text-text-tertiary">
              #{pack.game.gameNumber}
            </span>

            <p className="text-sm font-medium text-text">
              {pack.game.name}
            </p>
          </div>

          <p className="mt-1 font-mono text-xs text-text-secondary">
            {pack.serialNumber}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm text-text">
            {formatCurrency(Number(pack.game.price))}
          </p>

          <p className="text-xs text-text-tertiary">
            per ticket
          </p>
        </div>

        <div className="text-right">
          <p className="font-mono text-sm text-text">
            {formatCurrency(Number(pack.retailValue))}
          </p>

          <p className="text-xs text-text-tertiary">
            retail value
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm text-text-secondary">
            {formatDate(pack.receivedAt)}
          </p>

          <p className="text-xs text-text-tertiary">
            {pack.receivedById}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={pack.status} />

          {pack.status === "BACK_STOCK" && (
            <Button
              variant="default"
              size="sm"
              onClick={activatePack}
            >
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