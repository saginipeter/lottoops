"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Bookmark, ChevronDown, Eye, FileBarChart2, History, Package, Printer, RefreshCw, ShieldAlert, Store, TicketCheck, Upload, Users, X } from "lucide-react";
import { FinancialReports } from "@/components/reports/financial-reports";
import { ActivityReport } from "@/components/reports/activity-report";
import { InventoryStatusReport } from "@/components/reports/inventory-status-report";
import { InventoryAgingReport } from "@/components/reports/inventory-aging-report";
import { DiscrepancyReport } from "@/components/reports/discrepancy-report";
import { CorrectionReport } from "@/components/reports/correction-report";
import { LifecycleAnalyticsReport } from "@/components/reports/lifecycle-analytics-report";
import { ExceptionTrendsReport } from "@/components/reports/exception-trends-report";
import { AiDiscrepancyAnalysis } from "@/components/reports/ai-discrepancy-analysis";
import { WhatsAppSummaryCard } from "@/components/reports/whatsapp-summary-card";
import { TicketReportsPanel } from "@/components/reports/ticket-reports-panel";
import { TicketReturnRequestsPanel } from "@/components/reports/ticket-return-requests-panel";
import { ShipmentOverrideNotifications } from "@/components/reports/shipment-override-notifications";
import { ReceivingShipmentsReport } from "@/components/reports/receiving-shipments-report";
import { StateReportsUploader } from "@/components/owner/state-reports-uploader";

type Role = "OWNER" | "MANAGER" | "EMPLOYEE" | "SHIFT_LEAD" | "PLATFORM_ADMIN" | "AUDITOR";
type ReportKey = "shift-sales" | "activity" | "inventory" | "inventory-aging" | "discrepancies" | "corrections" | "lifecycle" | "exceptions" | "ai-review" | "whatsapp" | "ticket-reports" | "returns" | "shipment-overrides" | "receiving-shipments" | "state-uploads";

interface ReportOption {
  key: ReportKey;
  label: string;
  description: string;
  group: string;
  icon: typeof BarChart3;
  minimumRole?: "MANAGER" | "OWNER";
}

const roleRank: Record<Role, number> = { EMPLOYEE: 1, AUDITOR: 2, SHIFT_LEAD: 2, MANAGER: 3, OWNER: 4, PLATFORM_ADMIN: 5 };

const reportOptions: ReportOption[] = [
  { key: "shift-sales", label: "Shift Sales Report", description: "Sales, ticket counts, margin, and printable shift audit records.", group: "Sales & Operations", icon: TicketCheck },
  { key: "activity", label: "Activity Report", description: "Understand who changed what, when, and from which store.", group: "Sales & Operations", icon: History },
  { key: "inventory", label: "Inventory Status", description: "Current stock, active displays, and pack-level inventory posture.", group: "Inventory", icon: Package },
  { key: "inventory-aging", label: "Inventory Aging", description: "Identify stock that has remained in inventory too long.", group: "Inventory", icon: Store },
  { key: "discrepancies", label: "Discrepancies", description: "Review unresolved stock and sequence discrepancies.", group: "Controls", icon: ShieldAlert },
  { key: "corrections", label: "Manager Corrections", description: "Review protected overrides and manager-authorized corrections.", group: "Controls", icon: RefreshCw, minimumRole: "MANAGER" },
  { key: "lifecycle", label: "Pack Lifecycle", description: "Track pack receiving, activation, sales, and completion.", group: "Analytics", icon: BarChart3 },
  { key: "exceptions", label: "Exception Trends", description: "See recurring operational exceptions over time.", group: "Analytics", icon: BarChart3 },
  { key: "ai-review", label: "AI Discrepancy Review", description: "Generate a manager review of unusual discrepancies.", group: "Management", icon: ShieldAlert, minimumRole: "MANAGER" },
  { key: "whatsapp", label: "Daily Summary", description: "Send the current operational summary to the configured channel.", group: "Management", icon: Users, minimumRole: "MANAGER" },
  { key: "ticket-reports", label: "Employee Ticket Reports", description: "Review tickets reported by employees for manager action.", group: "Management", icon: FileBarChart2, minimumRole: "MANAGER" },
  { key: "returns", label: "Ticket Return Requests", description: "Approve or deny ticket return requests.", group: "Management", icon: RefreshCw, minimumRole: "MANAGER" },
  { key: "shipment-overrides", label: "Shipment Overrides", description: "Review receiving overrides and exception notifications.", group: "Management", icon: Package, minimumRole: "MANAGER" },
  { key: "receiving-shipments", label: "Receiving Shipments", description: "Search historical shipment records, receiver names, and pack counts.", group: "Inventory", icon: Package, minimumRole: "MANAGER" },
  { key: "state-uploads", label: "State Report Uploads", description: "Upload required state reports and supporting evidence.", group: "Management", icon: Upload, minimumRole: "MANAGER" },
];

function canSee(option: ReportOption, role: Role) {
  return !option.minimumRole || roleRank[role] >= roleRank[option.minimumRole];
}

export function ReportsWorkspace({ role }: { role: Role }) {
  const available = useMemo(() => reportOptions.filter((option) => canSee(option, role)), [role]);
  const [selected, setSelected] = useState<ReportKey>("shift-sales");
  const [favorites, setFavorites] = useState<ReportKey[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("lottoops-report-favorites") ?? "[]") as ReportKey[];
      setFavorites(saved.filter((key) => available.some((option) => option.key === key)));
    } catch {
      setFavorites([]);
    }
  }, [available]);

  useEffect(() => {
    if (!available.some((option) => option.key === selected)) setSelected(available[0]?.key ?? "shift-sales");
  }, [available, selected]);

  useEffect(() => {
    if (!previewOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewOpen]);

  const current = available.find((option) => option.key === selected) ?? available[0];
  if (!current) return null;
  const Icon = current.icon;

  function toggleFavorite() {
    const next = favorites.includes(current.key) ? favorites.filter((key) => key !== current.key) : [...favorites, current.key];
    setFavorites(next);
    window.localStorage.setItem("lottoops-report-favorites", JSON.stringify(next));
  }

  function printSelectedReport() {
    document.body.classList.add("report-printing");
    const cleanup = () => document.body.classList.remove("report-printing");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(() => window.print(), 50);
  }

  function renderReport() {
    switch (current.key) {
      case "shift-sales": return <FinancialReports />;
      case "activity": return <ActivityReport />;
      case "inventory": return <InventoryStatusReport />;
      case "inventory-aging": return <InventoryAgingReport />;
      case "discrepancies": return <DiscrepancyReport />;
      case "corrections": return <CorrectionReport />;
      case "lifecycle": return <LifecycleAnalyticsReport />;
      case "exceptions": return <ExceptionTrendsReport />;
      case "ai-review": return <AiDiscrepancyAnalysis />;
      case "whatsapp": return <WhatsAppSummaryCard />;
      case "ticket-reports": return <TicketReportsPanel title="Employee Ticket Reports" />;
      case "returns": return <TicketReturnRequestsPanel title="Ticket Return Requests" />;
      case "shipment-overrides": return <ShipmentOverrideNotifications />;
      case "receiving-shipments": return <ReceivingShipmentsReport />;
      case "state-uploads": return <StateReportsUploader />;
    }
  }

  const groups = Array.from(new Set(available.map((option) => option.group)));
  return (
    <div className="space-y-4">
      <section className="border border-[#cbd5e1] bg-white p-4 shadow-[0_5px_0_rgba(23,35,63,0.06)] sm:p-5" aria-label="Report selector">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#087da8]">Report workspace</p>
            <h2 className="mt-1 text-xl font-black text-[#17233f]">Select a report to generate</h2>
            <p className="mt-1 text-sm text-slate-500">Reports are isolated into focused views. Use each report&apos;s date, shift, export, and print controls.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="report-selector">Choose report</label>
            <div className="relative min-w-0 sm:min-w-[280px]">
              <select id="report-selector" value={current.key} onChange={(event) => setSelected(event.target.value as ReportKey)} className="min-h-12 w-full appearance-none border-2 border-[#17233f] bg-white px-3 pr-10 text-sm font-bold text-[#17233f] outline-none focus:border-[#087da8] focus:ring-4 focus:ring-[#087da8]/15">
                {groups.map((group) => <optgroup key={group} label={group}>{available.filter((option) => option.group === group).map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</optgroup>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#17233f]" size={17} />
            </div>
            <button type="button" onClick={toggleFavorite} className={`inline-flex min-h-12 items-center justify-center gap-2 border-2 px-4 text-xs font-black ${favorites.includes(current.key) ? "border-[#087da8] bg-[#e0f6fc] text-[#087da8]" : "border-slate-200 bg-white text-slate-600 hover:border-[#087da8]"}`} aria-label={favorites.includes(current.key) ? "Remove report from favorites" : "Add report to favorites"}>
              <Bookmark size={16} fill={favorites.includes(current.key) ? "currentColor" : "none"} /> {favorites.includes(current.key) ? "Pinned" : "Pin report"}
            </button>
          </div>
        </div>
        {favorites.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Quick access</span>{favorites.map((key) => { const option = available.find((item) => item.key === key); return option ? <button key={key} type="button" onClick={() => setSelected(key)} className={`border px-3 py-2 text-xs font-bold ${selected === key ? "border-[#087da8] bg-[#e0f6fc] text-[#087da8]" : "border-slate-200 text-slate-600 hover:border-[#087da8]"}`}>{option.label}</button> : null; })}</div>}
      </section>
      <section
        aria-labelledby="selected-report-title"
        role={previewOpen ? "dialog" : undefined}
        aria-modal={previewOpen || undefined}
        className={previewOpen ? "fixed inset-0 z-[70] overflow-y-auto bg-black/55 p-3 sm:p-6" : ""}
      >
        <div className={previewOpen ? "mx-auto max-w-[1440px] bg-white p-4 shadow-2xl sm:p-6" : ""}>
          {previewOpen && <div className="mb-3 flex items-center justify-between border-b border-border pb-3 print:hidden"><p className="text-sm font-bold text-text">Report preview</p><button type="button" onClick={() => setPreviewOpen(false)} className="inline-flex min-h-10 items-center gap-2 border border-border px-3 text-sm font-semibold text-text hover:bg-surface-soft"><X size={15} />Close preview</button></div>}
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-l-4 border-[#087da8] bg-[#17233f] px-4 py-3 text-white sm:items-center">
            <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#087da8] text-white"><Icon size={18} /></span><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8be2ff]">{current.group}</p><h2 id="selected-report-title" className="truncate text-lg font-black">{current.label}</h2></div></div>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <p className="hidden max-w-md text-right text-xs text-white/65 lg:block">{current.description}</p>
              <button type="button" onClick={() => setPreviewOpen(true)} className="inline-flex min-h-10 items-center gap-2 border border-white/30 px-3 text-xs font-bold text-white hover:bg-white/10"><Eye size={14} />View Report</button>
              {current.key !== "shift-sales" && <button type="button" onClick={printSelectedReport} className="inline-flex min-h-10 items-center gap-2 bg-white px-3 text-xs font-bold text-[#17233f] hover:bg-slate-100"><Printer size={14} />Print Report</button>}
            </div>
          </div>
          <div className="report-workspace-print-target">{renderReport()}</div>
        </div>
      </section>
    </div>
  );
}
