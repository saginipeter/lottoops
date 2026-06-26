import { Header } from "@/components/layout/header";
import { ShiftCard, type ShiftCardProps } from "@/components/home/shift-card";

const cards: ShiftCardProps[] = [
  {
    href: "/shifts/open",
    badgeLabel: "O",
    badgeColor: "#3B2E7E",
    status: "Start",
    statusTone: "success",
    title: "Open Shift",
    description: "Start the opening scan sheet. No close-shift choices on this screen.",
    stat: "0 of 50 opening scans",
  },
  {
    href: "/shifts/opening-audit",
    badgeLabel: "BA",
    badgeColor: "#6B3FA0",
    status: "After open",
    statusTone: "warning",
    title: "Beginning Shift Audit Trail",
    description: "Review opening scan activity and save or print the beginning audit trail.",
    stat: "Shift 1 · Jun 17",
  },
  {
    href: "/shifts/live-sales",
    badgeLabel: "L",
    badgeColor: "#1D9E75",
    status: "$0",
    statusTone: "neutral",
    title: "Live Shift Sales",
    description: "Scan one customer's tickets, click Done, then enter the shown total in the register.",
    stat: "0 in current transaction",
  },
  {
    href: "/shifts/close",
    badgeLabel: "C",
    badgeColor: "#A33D9A",
    status: "Open first",
    statusTone: "danger",
    title: "Close Shift",
    description: "Start the closing scan sheet. Opening must be saved first.",
    stat: "0 of 50 closing scans",
  },
  {
    href: "/shifts/closing-audit",
    badgeLabel: "EA",
    badgeColor: "#C13584",
    status: "After close",
    statusTone: "warning",
    title: "Ending Shift Audit Trail",
    description: "Review closing scan activity and save or print the ending audit trail.",
    stat: "Shift 1 · Jun 17",
  },
  {
    href: "/reports/scratchoff-sales",
    badgeLabel: "$",
    badgeColor: "#E8505B",
    status: "$500",
    statusTone: "neutral",
    title: "Scratchoff Sales Check",
    description: "Review saved scratchoff sales. Correct only a missing or wrong sale.",
    stat: "4 sales entries",
  },
  {
    href: "/reports/closeout",
    badgeLabel: "P",
    badgeColor: "#3B2E7E",
    status: "Register saved",
    statusTone: "success",
    title: "Reports / Print Closeout",
    description: "Enter register scratchoff sales, check variance, and print the closeout packet.",
    stat: "19 tickets sold",
  },
  {
    href: "/reports/shift-report",
    badgeLabel: "SR",
    badgeColor: "#1D9E75",
    status: "Balanced",
    statusTone: "success",
    title: "Printable Shift Report",
    description: "Print one shift report with lottery, lotto, payout, and cash totals.",
    stat: "Saved Jun 17 · 2:58 PM",
  },
  {
    href: "/reports/manager-day-close",
    badgeLabel: "C",
    badgeColor: "#A33D9A",
    status: "Balanced",
    statusTone: "success",
    title: "Manager Day Close",
    description: "Compare register, lotto machine, LottoOps, payouts, and cash totals.",
    stat: "Saved Jun 17 · 10:38 PM",
  },
  {
    href: "/settings/tv-display",
    badgeLabel: "TV",
    badgeColor: "#6E6C85",
    status: "On",
    statusTone: "neutral",
    title: "TV Display",
    description: "Show active scratchoff games on the customer TV or external display.",
    stat: "5 live games",
  },
  {
    href: "/settings/manager-review",
    badgeLabel: "U",
    badgeColor: "#9795A8",
    status: "Review",
    statusTone: "warning",
    title: "Manager Review",
    description: "Review users, settings, audit trail, catalog, permissions, and owner reset.",
    stat: "5 audit events",
  },
  {
    href: "/reports/margin-calculator",
    badgeLabel: "M",
    badgeColor: "#F5A623",
    status: "Ready",
    statusTone: "neutral",
    title: "Merchandise Profit Margin Calculator",
    description: "Calculate product price, margin, promo price, tags, and department totals.",
    stat: "3 products",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="LottoOps"
        subtitle="Wed, June 17 2026 · Sunrise Mart #4"
      />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-4 gap-4">
          {cards.map((card) => (
            <ShiftCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
}