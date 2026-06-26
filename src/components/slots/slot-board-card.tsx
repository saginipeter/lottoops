import { DisplaySlot } from "@/lib/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { getGame, formatCurrency, getTicketProgress } from "@/lib/utils";
import { LayoutGrid, MoveRight } from "lucide-react";
import clsx from "clsx";

interface SlotBoardCardProps {
  slot: DisplaySlot;
  onActivate: (slotNumber: string) => void;
}

export function SlotBoardCard({ slot, onActivate }: SlotBoardCardProps) {
  const { slotNumber, pack } = slot;

  if (!pack) {
    return (
      <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-border bg-surface-soft p-5 text-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface text-xs font-bold text-text-tertiary">
          {slotNumber}
        </span>
        <div>
          <p className="text-[13px] font-medium text-text-secondary">Empty slot</p>
          <p className="mt-0.5 text-[11px] text-text-tertiary">No pack on display</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onActivate(slotNumber)}
        >
          Activate
          <MoveRight size={13} />
        </Button>
      </div>
    );
  }

  const game = getGame(pack.gameId);
  if (!game) return null;

  const isSoldOut = pack.status === "sold-out";
  const progress = getTicketProgress(pack);

  return (
    <div
      className={clsx(
        "flex flex-col gap-2.5 rounded-xl border p-4",
        isSoldOut ? "border-danger/30 bg-danger-soft/30" : "border-border bg-surface"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-soft text-xs font-bold text-text-secondary">
          {slotNumber}
        </span>
        <StatusBadge status={pack.status} />
      </div>

      <div>
        <p className="font-mono text-[11px] text-text-tertiary">#{game.gameNumber}</p>
        <p className="text-[14px] font-semibold leading-snug text-text">{game.name}</p>
      </div>

      <div className="flex items-center justify-between text-[12px] text-text-secondary">
        <span>{formatCurrency(game.price)} / ticket</span>
        <span className="font-mono">
          {String(pack.currentTicketNumber ?? 0).padStart(3, "0")} left
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-surface-soft">
        <div
          className={clsx(
            "h-full rounded-full",
            isSoldOut ? "bg-danger" : "bg-accent"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {isSoldOut && (
        <Button
          variant="primary"
          size="sm"
          className="mt-1 w-full justify-center"
          onClick={() => onActivate(slotNumber)}
        >
          <LayoutGrid size={13} />
          Replace pack
        </Button>
      )}
    </div>
  );
}