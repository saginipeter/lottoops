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
  const quantity = Number(ticketQuantity ?? 0);
  const orderedCandidates =
    firstOrLastTicket === "LAST"
      ? [ticketQuantity, firstTicket, currentTicketNumber]
      : [currentTicketNumber, firstTicket, ticketQuantity];

  const validCandidates = orderedCandidates
    .map((value) => Number(value ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0 && (quantity <= 0 || value <= quantity));

  return validCandidates[0] ?? (quantity > 0 ? quantity : null);
}

export function getDisplayedCurrentTicket({
  currentTicketNumber,
  firstTicket,
  ticketQuantity,
}: {
  currentTicketNumber: number | null;
  firstTicket: number | null;
  ticketQuantity: number | null;
}): number {
  const current = Number(currentTicketNumber ?? 0);
  const first = Number(firstTicket ?? 0);
  const quantity = Number(ticketQuantity ?? 0);

  if (Number.isFinite(current) && current > 0 && quantity > 0 && current <= quantity) {
    return current;
  }

  if (Number.isFinite(first) && first > 0 && quantity > 0 && first <= quantity) {
    return first;
  }

  if (Number.isFinite(quantity) && quantity > 0) {
    return quantity;
  }

  if (Number.isFinite(first) && first > 0) {
    return first;
  }

  if (Number.isFinite(current) && current > 0) {
    return current;
  }

  return 0;
}
