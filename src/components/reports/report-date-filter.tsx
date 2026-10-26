"use client";

import { CalendarDays } from "lucide-react";

export interface ReportDateRangeValue {
  from: string;
  to: string;
}

interface ReportDateFilterProps {
  value: ReportDateRangeValue;
  onChange: (value: ReportDateRangeValue) => void;
  compact?: boolean;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function ReportDateFilter({ value, onChange, compact = false }: ReportDateFilterProps) {
  function setPreset(days: number) {
    const to = todayString();
    onChange({ from: dateDaysAgo(days), to });
  }

  return (
    <div className={`flex flex-wrap items-end gap-2 ${compact ? "" : "border border-[#cbd5e1] bg-white p-3"}`}>
      <div className="flex items-center gap-1.5 text-[#087da8]">
        <CalendarDays size={15} />
        <span className="text-[10px] font-black uppercase tracking-[0.14em]">Date range</span>
      </div>
      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        From
        <input
          aria-label="Report from date"
          type="date"
          value={value.from}
          max={value.to}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
          className="min-h-10 border border-slate-300 bg-white px-2.5 text-sm font-medium normal-case tracking-normal text-[#17233f] outline-none focus:border-[#087da8] focus:ring-2 focus:ring-[#087da8]/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        To
        <input
          aria-label="Report to date"
          type="date"
          value={value.to}
          min={value.from}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
          className="min-h-10 border border-slate-300 bg-white px-2.5 text-sm font-medium normal-case tracking-normal text-[#17233f] outline-none focus:border-[#087da8] focus:ring-2 focus:ring-[#087da8]/20"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {[{ label: "Today", days: 0 }, { label: "7 days", days: 7 }, { label: "30 days", days: 30 }, { label: "90 days", days: 90 }].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setPreset(preset.days)}
            className="min-h-10 border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-600 transition-colors hover:border-[#087da8] hover:bg-[#e0f6fc] hover:text-[#087da8]"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
