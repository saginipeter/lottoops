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
        "grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border bg-surface px-5",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">{left}</div>
      <div className="flex items-center justify-center text-xs text-text-tertiary">{center}</div>
      <div className="flex items-center justify-end gap-2">{right}</div>
    </div>
  );
}