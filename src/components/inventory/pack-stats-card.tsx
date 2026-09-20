import { Panel } from "@/components/ui/panel";
import { getRemainingTicketCount } from "@/lib/tv-display";

interface PackStats {
  currentTicketNumber?: number | null;
  firstTicket?: number | null;
  ticketQuantity?: number | null;
  retailValue?: number | string | null;
  cost?: number | string | null;
}

export function PackStatsCard({ pack }: { pack: PackStats }) {
  const quantity = Number(pack.ticketQuantity ?? 0);
  const remaining = getRemainingTicketCount(pack.currentTicketNumber ?? null, quantity);
  const sold = Math.max(quantity - remaining, 0);

  return (
    <Panel className="p-6">
      <h2 className="mb-5 font-semibold">Statistics</h2>
      <Stat label="Tickets Sold" value={sold} />
      <Stat label="Tickets Remaining" value={remaining} />
      <Stat label="Retail Value" value={`$${pack.retailValue ?? 0}`} />
      <Stat label="Cost" value={`$${pack.cost ?? 0}`} />
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="mb-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
