import clsx from "clsx";
import { Panel } from "@/components/ui/panel";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  valueSuffix?: string;
  sub?: string;
  subIcon?: LucideIcon;
  subTone?: "success" | "warning" | "danger" | "neutral";
}

const subToneClasses = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-text-secondary",
};

export function StatCard({
  label,
  value,
  valueSuffix,
  sub,
  subIcon: SubIcon,
  subTone = "neutral",
}: StatCardProps) {
  return (
    <Panel className="px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
        {label}
      </p>
      <p className="mt-1.5 text-[22px] font-medium leading-none text-text">
        {value}
        {valueSuffix && (
          <span className="ml-1 text-[13px] text-text-tertiary">
            {valueSuffix}
          </span>
        )}
      </p>
      {sub && (
        <p
          className={clsx(
            "mt-[3px] flex items-center gap-1 text-[10px]",
            subToneClasses[subTone]
          )}
        >
          {SubIcon && <SubIcon size={11} />}
          {sub}
        </p>
      )}
    </Panel>
  );
}
