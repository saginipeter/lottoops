import { PackStatus } from "@/lib/types";
import clsx from "clsx";

const statusConfig: Record<PackStatus, { label: string; className: string }> = {
  "back-stock": {
    label: "Back stock",
    className: "bg-accent-soft text-accent-soft-text",
  },
  active: {
    label: "Active",
    className: "bg-success-soft text-success-soft-text",
  },
  "sold-out": {
    label: "Sold out",
    className: "bg-danger-soft text-danger-soft-text",
  },
  returned: {
    label: "Returned",
    className: "bg-surface-soft text-text-tertiary",
  },
};

export function StatusBadge({ status }: { status: PackStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-[7px] py-[2px] text-[10px] font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
