import { X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface ScannedPack {
  serialNumber: string;
  scannedAt: string; // ISO timestamp, used as a stable key
}

interface BatchListProps {
  items: ScannedPack[];
  gameName: string;
  retailValuePerPack: number;
  onRemove: (serialNumber: string) => void;
}

export function BatchList({
  items,
  gameName,
  retailValuePerPack,
  onRemove,
}: BatchListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 px-5 py-12 text-center">
        <p className="text-sm font-medium text-text-secondary">
          No packs scanned yet
        </p>
        <p className="text-xs text-text-tertiary">
          Scan a pack serial number above to add it to this batch.
        </p>
      </div>
    );
  }

  return (
    <div>
      {items.map((item, i) => (
        <div
          key={item.serialNumber}
          className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-soft text-[10px] font-medium text-success-soft-text">
              {i + 1}
            </span>
            <span className="font-mono text-xs text-text">
              {item.serialNumber}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-tertiary">{gameName}</span>
            <button
              onClick={() => onRemove(item.serialNumber)}
              className="rounded p-1 text-text-tertiary hover:bg-danger-soft hover:text-danger transition-colors"
              aria-label={`Remove ${item.serialNumber} from batch`}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-border bg-surface-soft px-4 py-2.5">
        <span className="text-xs font-medium text-text-secondary">
          {items.length} pack{items.length !== 1 ? "s" : ""} scanned
        </span>
        <span className="font-mono text-xs font-semibold text-text">
          {formatCurrency(items.length * retailValuePerPack)} retail value
        </span>
      </div>
    </div>
  );
}