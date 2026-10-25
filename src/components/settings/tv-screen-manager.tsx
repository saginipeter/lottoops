import Link from "next/link";
import { ExternalLink, MonitorPlay, Tv } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { TV_SCREEN_CAPACITY, TV_SCREEN_COLUMNS, TV_SCREEN_ROWS } from "@/lib/tv-screens";

export interface TvScreenSummary {
  screenNumber: number;
  activeCount: number;
  firstSlotNumber: string | null;
  lastSlotNumber: string | null;
}

interface TvScreenManagerProps {
  summaries: readonly TvScreenSummary[];
  selectedScreenNumber: number;
  refreshSeconds: number;
  canManageScreens: boolean;
}

function rangeLabel(summary: TvScreenSummary): string {
  if (summary.activeCount === 0) return "No active display entries";
  if (summary.firstSlotNumber === summary.lastSlotNumber) return `Display ${summary.firstSlotNumber}`;
  return `Displays ${summary.firstSlotNumber}–${summary.lastSlotNumber}`;
}

export function TvScreenManager({
  summaries,
  selectedScreenNumber,
  refreshSeconds,
  canManageScreens,
}: TvScreenManagerProps) {
  const knownSummary = summaries.find((summary) => summary.screenNumber === selectedScreenNumber);
  const selectedSummary: TvScreenSummary = knownSummary ?? {
    screenNumber: selectedScreenNumber,
    activeCount: 0,
    firstSlotNumber: null,
    lastSlotNumber: null,
  };
  const cards = summaries.some((summary) => summary.screenNumber === selectedScreenNumber)
    ? summaries
    : [...summaries, selectedSummary].sort((left, right) => left.screenNumber - right.screenNumber);

  return (
    <Panel className="border-accent/30 bg-surface-soft p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-teal-100 p-2 text-teal-700"><Tv size={18} /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">TV Screens</p>
            <h2 className="mt-1 text-lg font-semibold text-text">Manage fixed screen links</h2>
            <p className="mt-1 max-w-3xl text-sm text-text-secondary">
              Each screen displays up to {TV_SCREEN_CAPACITY} active entries in a {TV_SCREEN_COLUMNS}-column × {TV_SCREEN_ROWS}-row grid. Overflow moves to the next screen automatically; a screen link remains stable even when its inventory is temporarily empty.
            </p>
          </div>
        </div>
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-right text-xs text-text-secondary">
          <div className="font-semibold text-text">Screen {selectedScreenNumber}</div>
          <div>{selectedSummary.activeCount}/{TV_SCREEN_CAPACITY} entries</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((summary) => {
          const isSelected = summary.screenNumber === selectedScreenNumber;
          const settingsHref = `/settings/tv-display?screen=${summary.screenNumber}&interval=${refreshSeconds}`;
          const displayHref = `/tv-display?screen=${summary.screenNumber}&interval=${refreshSeconds}`;
          return (
            <div key={summary.screenNumber} className={`rounded-lg border p-4 transition-colors ${isSelected ? "border-accent bg-accent/5 shadow-sm" : "border-border bg-surface"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text">Screen {summary.screenNumber}</p>
                  <p className="mt-1 text-xs text-text-secondary">{rangeLabel(summary)}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${summary.activeCount ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-600"}`}>
                  {summary.activeCount}/{TV_SCREEN_CAPACITY}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, (summary.activeCount / TV_SCREEN_CAPACITY) * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs text-text-tertiary">
                {summary.activeCount >= TV_SCREEN_CAPACITY ? "At capacity" : `${TV_SCREEN_CAPACITY - summary.activeCount} open entr${TV_SCREEN_CAPACITY - summary.activeCount === 1 ? "y" : "ies"}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={settingsHref} className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium ${isSelected ? "bg-accent text-white" : "border border-border bg-surface-soft text-text hover:bg-surface"}`}>
                  <MonitorPlay size={13} />{isSelected ? "Selected" : "Preview"}
                </Link>
                <Link href={displayHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-text hover:bg-surface-soft">
                  Open TV <ExternalLink size={13} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      {!canManageScreens && <p className="mt-4 text-xs text-text-tertiary">Preview links are available to all staff. A manager or owner is required to create a signed store link for a physical TV.</p>}
    </Panel>
  );
}
