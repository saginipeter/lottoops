import { cn } from "@/lib/utils";

interface StatusBarProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function StatusBar({ left, center, right, className }: StatusBarProps) {
  return (
    <div
      className={cn(
        "grid h-[42px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-[#cfd6e3] bg-[#e8ecf3] px-5 text-xs text-[#4d5b70]",
        className
      )}
    >
      <div className="truncate">{left}</div>
      <div className="truncate text-center">{center}</div>
      <div className="flex items-center justify-end gap-2">{right}</div>
    </div>
  );
}
