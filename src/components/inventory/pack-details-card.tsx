import { Panel } from "@/components/ui/panel";
import { getDisplayedTicketNumber } from "@/lib/tv-display";

export function PackDetailsCard({
  pack,
}: any) {

  return (

    <Panel className="p-6">

      <h2 className="mb-5 text-xl font-semibold">

        Pack Information

      </h2>

      <div className="grid grid-cols-2 gap-6">

        <Info
          label="Game"
          value={pack.game.name}
        />

        <Info
          label="Game Number"
          value={pack.gameNumber}
        />

        <Info
          label="Pack Number"
          value={pack.packNumber}
        />

        <Info
          label="Status"
          value={pack.status}
        />

        <Info
          label="First Ticket"
          value={pack.firstTicket}
        />

        <Info
          label="Current Ticket"
          value={
            getDisplayedTicketNumber(
              Number(pack.firstTicket ?? 1),
              Number(pack.currentTicketNumber ?? pack.ticketQuantity ?? 0),
              Number(pack.ticketQuantity ?? 0),
              pack.firstOrLastTicket === "LAST" ? "LAST" : "FIRST",
            )
          }
        />

        <Info
          label="Ticket Quantity"
          value={pack.ticketQuantity}
        />

        <Info
          label="Ticket Price"
          value={`$${pack.ticketPrice}`}
        />

      </div>

    </Panel>

  );

}

function Info({
  label,
  value,
}: any) {

  return (

    <div>

      <p className="text-xs uppercase text-gray-500">

        {label}

      </p>

      <p className="mt-1 font-semibold">

        {value}

      </p>

    </div>

  );

}
