import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineGuidanceProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function InlineGuidance({ title, children, className }: InlineGuidanceProps) {
  return (
    <div
      role="note"
      aria-label={`${title} instructions`}
      className={cn(
        "mb-4 flex items-start gap-3 border border-slate-200 bg-white p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center bg-[#087da8]/10 text-[#087da8]">
        <Info size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#087da8]">{title}</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{children}</p>
      </div>
    </div>
  );
}
