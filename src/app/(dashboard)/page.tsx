import { Header } from "@/components/layout/header";
import { ShiftCard, type ShiftCardProps } from "@/components/home/shift-card";

const cards: ShiftCardProps[] = [
  {
    href: "/shifts",
    badgeLabel: "S",
    badgeColor: "#3B2E7E",
    status: "Daily",
    statusTone: "success",
    title: "Shift Management",
    description: "Open and close shifts, track shift progress, and keep audit activity in one place.",
    stat: "Open / close workflow",
    actionLabel: "Open",
  },
  {
    href: "/inventory/live-scan",
    badgeLabel: "LS",
    badgeColor: "#1D9E75",
    status: "Live",
    statusTone: "neutral",
    title: "Live Scan",
    description: "Scan tickets during the shift to keep display inventory and sales activity updated in real time.",
    stat: "Realtime scanning",
    actionLabel: "Scan",
  },
  {
    href: "/inventory/receive",
    badgeLabel: "R",
    badgeColor: "#A33D9A",
    status: "10 Steps",
    statusTone: "warning",
    title: "Receive Shipment",
    description: "Process incoming packs with the full receiving workflow, including invoice and confirmation details.",
    stat: "Invoice to confirmation",
    actionLabel: "Receive",
  },
  {
    href: "/display-slots",
    badgeLabel: "DS",
    badgeColor: "#6B3FA0",
    status: "Active",
    statusTone: "success",
    title: "Display Slots",
    description: "Assign packs to slots and monitor what is currently active on display.",
    stat: "Slot assignment",
    actionLabel: "Manage",
  },
  {
    href: "/inventory",
    badgeLabel: "B",
    badgeColor: "#E8505B",
    status: "Inventory",
    statusTone: "neutral",
    title: "Back Stock",
    description: "Review packs in back stock, activate packs, and track inventory readiness.",
    stat: "Back stock view",
    actionLabel: "View",
  },
  {
    href: "/inventory/active",
    badgeLabel: "A",
    badgeColor: "#3B2E7E",
    status: "Display",
    statusTone: "success",
    title: "Active Stock",
    description: "Monitor active packs on display and handle removal or reassignment workflows.",
    stat: "Active pack tracking",
    actionLabel: "Open",
  },
  {
    href: "/sales",
    badgeLabel: "$",
    badgeColor: "#1D9E75",
    status: "Sales",
    statusTone: "neutral",
    title: "Sales",
    description: "Review sales and run sales-related workflows from a single page.",
    stat: "Sales workspace",
    actionLabel: "Open",
  },
  {
    href: "/reports",
    badgeLabel: "RP",
    badgeColor: "#A33D9A",
    status: "Insights",
    statusTone: "warning",
    title: "Reports",
    description: "Access summaries, scan logs, and reporting tools for daily and shift-level review.",
    stat: "Audit & reporting",
    actionLabel: "View",
  },
  {
    href: "/games",
    badgeLabel: "G",
    badgeColor: "#6E6C85",
    status: "Catalog",
    statusTone: "neutral",
    title: "Games",
    description: "Manage game catalog details used across receiving, activation, and sales.",
    stat: "Game setup",
    actionLabel: "Manage",
  },
  {
    href: "/settings",
    badgeLabel: "ST",
    badgeColor: "#9795A8",
    status: "Review",
    statusTone: "warning",
    title: "Settings",
    description: "Configure staff permissions and operational preferences while keeping controls centralized.",
    stat: "System controls",
    actionLabel: "Open",
  },
  {
    href: "/settings/tv-display",
    badgeLabel: "TV",
    badgeColor: "#6E6C85",
    status: "Display",
    statusTone: "neutral",
    title: "TV Display",
    description: "Control TV display options for showing games and active packs on customer-facing screens.",
    stat: "Customer screen",
    actionLabel: "Open",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Dashboard"
        subtitle="Quick links to daily operations"
      />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <ShiftCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
}