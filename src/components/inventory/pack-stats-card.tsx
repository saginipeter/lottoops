import { Panel } from "@/components/ui/panel";

export function PackStatsCard({
  pack,
}: any) {

  const current =
    pack.currentTicketNumber ??
    pack.firstTicket;

  const sold =
    current - pack.firstTicket;

  const remaining =
    pack.ticketQuantity - sold;

  return (

    <Panel className="p-6">

      <h2 className="mb-5 font-semibold">

        Statistics

      </h2>

      <Stat
        label="Tickets Sold"
        value={sold}
      />

      <Stat
        label="Tickets Remaining"
        value={remaining}
      />

      <Stat
        label="Retail Value"
        value={`$${pack.retailValue}`}
      />

      <Stat
        label="Cost"
        value={`$${pack.cost}`}
      />

    </Panel>

  );

}

function Stat({
  label,
  value,
}: any) {

  return (

    <div className="mb-5">

      <div className="text-sm text-gray-500">

        {label}

      </div>

      <div className="text-2xl font-bold">

        {value}

      </div>

    </div>

  );

}