export function validateEndingTicket(beginningTicket: number, endingTicket: number): string | null {
  if (!Number.isInteger(beginningTicket) || beginningTicket < 0) return "Beginning ticket must be a non-negative integer.";
  if (!Number.isInteger(endingTicket) || endingTicket < 0 || endingTicket > beginningTicket) return `Ending ticket must be an integer from 0 through ${beginningTicket}.`;
  return null;
}

export function remainingTicketsFromStartingTicket(startingTicket: number, ticketsPerPack: number): number {
  if (!Number.isInteger(startingTicket) || !Number.isInteger(ticketsPerPack) || startingTicket < 1 || ticketsPerPack < startingTicket) return 0;
  return ticketsPerPack - startingTicket + 1;
}

export function expectedPhysicalTicket(firstTicket: number, ticketsPerPack: number, remainingTickets: number): number | null {
  if (!Number.isInteger(firstTicket) || !Number.isInteger(ticketsPerPack) || !Number.isInteger(remainingTickets)) return null;
  if (firstTicket < 1 || ticketsPerPack < 1 || remainingTickets < 0 || remainingTickets > ticketsPerPack) return null;
  const initialRemaining = ticketsPerPack - firstTicket + 1;
  if (remainingTickets > initialRemaining) return null;
  return firstTicket + (initialRemaining - remainingTickets);
}

export function expectedPhysicalTicketByDirection(
  firstTicket: number,
  ticketsPerPack: number,
  remainingTickets: number,
  direction?: string | null,
): number | null {
  if (direction === "LAST") {
    const remaining = Math.max(0, Math.min(Number(remainingTickets) || 0, ticketsPerPack));
    return remaining > 0 ? remaining : 0;
  }
  return expectedPhysicalTicket(firstTicket, ticketsPerPack, remainingTickets);
}

export function physicalTicketFromRemaining(firstTicket: number, ticketsPerPack: number, remainingTickets: number): number | null {
  if (remainingTickets === 0) return 0;
  return expectedPhysicalTicket(firstTicket, ticketsPerPack, remainingTickets);
}

export function findUnassignedActivePacks(packs: Array<{ serialNumber: string; slot: unknown | null }>): string[] {
  return packs.filter((pack) => !pack.slot).map((pack) => pack.serialNumber);
}
