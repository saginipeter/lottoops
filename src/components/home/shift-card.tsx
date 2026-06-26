import Link from "next/link";
import clsx from "clsx";


export type StatusTone = "success" | "warning" | "danger" | "neutral";

export interface ShiftCardProps {
  href: string;
  badgeLabel: string; // short code shown in the top-left mark, e.g. "O", "BA", "$"
  badgeColor: string; // hex background for the mark
  status: string; // top-right pill text, e.g. "After open", "Open first"
  statusTone: StatusTone;
  title: string;
  description: string;
  stat: string; // bottom-left live readout, e.g. "0 OF 50 OPENING SCANS"
  actionLabel?: string; // bottom-right button text, defaults to "Open"
}

const statusToneClasses: Record<StatusTone, string> = {
  success: "bg-success-soft text-success-soft-text",
  warning: "bg-warning-soft text-warning-soft-text",
  danger: "bg-danger-soft text-danger-soft-text",
  neutral: "bg-surface-soft text-text-secondary",
};

export function ShiftCard({
  href,
  badgeLabel,
  badgeColor,
  status,
  statusTone,
  title,
  description,
  stat,
  actionLabel = "Open",
}: ShiftCardProps) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Top row — badge mark + status pill */}
      <div className="flex items-start justify-between">
        <div
          className="flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-xs font-bold text-white"
          style={{ backgroundColor: badgeColor }}
        >
          {badgeLabel}
        </div>
        <span
          className={clsx(
            "rounded-full px-2.5 py-1 text-[11px] font-medium",
            statusToneClasses[statusTone]
          )}
        >
          {status}
        </span>
      </div>

      {/* Title + description */}
      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-text">
        {title}
      </h3>
      <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-text-secondary">
        {description}
      </p>

      {/* Bottom row — live stat + action */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
          {stat}
        </span>
        <Link
          href={href}
          className="rounded-md bg-surface-soft px-3.5 py-1.5 text-[12.5px] font-medium text-text transition-colors hover:bg-accent hover:text-white"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}