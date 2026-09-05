import { cn } from "@/lib/utils";

interface PageToolbarProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function PageToolbar({ left, center, right, className }: PageToolbarProps) {
  return (
    <div
      className={cn(
        "grid min-h-12 shrink-0 grid-cols-1 items-center gap-2 border-b border-border bg-surface px-3 py-2 sm:h-12 sm:grid-cols-[1fr_auto_1fr] sm:gap-3 sm:px-5 sm:py-0",
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">{left}</div>
      <div className="flex min-w-0 flex-wrap items-center justify-start text-xs text-text-tertiary sm:justify-center">{center}</div>
      <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:justify-end">{right}</div>
    </div>
  );
}