import { PackStatus } from "@prisma/client";
import clsx from "clsx";

const statusConfig: Record<
  PackStatus | "COMPLETED",
  { label: string; className: string }
> = {
  RECEIVING: {
    label: "Receiving",
    className: "bg-blue-100 text-blue-700",
  },
BACK_STOCK: {
    label: "Back Stock",
    className: "bg-yellow-100 text-yellow-700",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-green-100 text-green-700",
  },
  SOLD_OUT: {
    label: "Sold Out",
    className: "bg-gray-100 text-gray-700",
  },
  RETURNED: {
    label: "Returned",
    className: "bg-red-100 text-red-700",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-blue-100 text-blue-700",
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
