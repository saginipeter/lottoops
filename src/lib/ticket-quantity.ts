export const TICKET_QUANTITY_PRESETS: Record<number, number> = {
  1: 50,
  2: 125,
  3: 125,
  5: 75,
  10: 50,
  20: 25,
  30: 25,
  50: 20,
  100: 15,
};

export function getSuggestedTicketQuantity(price: number): number {
  return TICKET_QUANTITY_PRESETS[price] ?? 30;
}

export function getActivationStartingTicket({
  currentTicketNumber,
  firstTicket,
  ticketQuantity,
  firstOrLastTicket,
}: {
  currentTicketNumber: number | null;
  firstTicket: number | null;
  ticketQuantity: number | null;
  firstOrLastTicket?: "FIRST" | "LAST";
}): number | null {
  const orderedCandidates =
    firstOrLastTicket === "LAST"
      ? [ticketQuantity, firstTicket, currentTicketNumber]
      : [currentTicketNumber, firstTicket, ticketQuantity];

  const firstValid = orderedCandidates
    .map((value) => Number(value ?? 0))
    .find((value) => Number.isFinite(value) && value > 0);

  return firstValid ?? null;
}
