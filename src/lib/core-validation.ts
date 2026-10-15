export function validateEndingTicket(beginningTicket: number, endingTicket: number): string | null {
  if (!Number.isInteger(beginningTicket) || beginningTicket < 0) return "Beginning ticket must be a non-negative integer.";
  if (!Number.isInteger(endingTicket) || endingTicket < 0 || endingTicket > beginningTicket) return `Ending ticket must be an integer from 0 through ${beginningTicket}.`;
  return null;
}

/** Signed close variance: physical closing ticket minus the system expectation. */
export function calculatePhysicalAuditVariance(
  expectedPhysicalTicket: number,
  observedPhysicalTicket: number,
): number | null {
  if (!Number.isInteger(expectedPhysicalTicket) || !Number.isInteger(observedPhysicalTicket)) return null;
  if (expectedPhysicalTicket < 0 || observedPhysicalTicket < 0) return null;
  return observedPhysicalTicket - expectedPhysicalTicket;
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
  if (!Number.isInteger(firstTicket) || !Number.isInteger(ticketsPerPack) || !Number.isInteger(remainingTickets)) return null;
  if (firstTicket < 1 || ticketsPerPack < firstTicket || remainingTickets < 0 || remainingTickets > ticketsPerPack) return null;
  if (remainingTickets === 0) return 0;
  if (direction === "LAST") {
    return remainingTickets;
  }
  return expectedPhysicalTicket(firstTicket, ticketsPerPack, remainingTickets);
}

export function physicalTicketFromRemaining(firstTicket: number, ticketsPerPack: number, remainingTickets: number): number | null {
  if (remainingTickets === 0) return 0;
  return expectedPhysicalTicket(firstTicket, ticketsPerPack, remainingTickets);
}

export function remainingTicketsFromPhysicalTicket(
  firstTicket: number,
  ticketsPerPack: number,
  physicalTicket: number,
  direction?: string | null,
): number | null {
  if (!Number.isInteger(firstTicket) || !Number.isInteger(ticketsPerPack) || !Number.isInteger(physicalTicket)) return null;
  if (firstTicket < 1 || ticketsPerPack < firstTicket || physicalTicket < 0) return null;
  if (physicalTicket === 0) return 0;

  if (direction === "LAST") {
    return physicalTicket <= ticketsPerPack ? physicalTicket : null;
  }

  if (physicalTicket < firstTicket || physicalTicket > ticketsPerPack) return null;
  const initialRemaining = ticketsPerPack - firstTicket + 1;
  return firstTicket + initialRemaining - physicalTicket;
}

/** Ticket-ID variance is separate from inventory; sold tickets cannot restore stock. */
export function calculatePhysicalAuditInventory(
  firstTicket: number,
  ticketsPerPack: number,
  expectedRemaining: number,
  observedPhysicalTicket: number,
  direction?: string | null,
): { expectedTicket: number; remaining: number; variance: number; scannedSoldTicket: boolean } | null {
  const expectedTicket = expectedPhysicalTicketByDirection(firstTicket, ticketsPerPack, expectedRemaining, direction);
  const observedRemaining = remainingTicketsFromPhysicalTicket(firstTicket, ticketsPerPack, observedPhysicalTicket, direction);
  if (expectedTicket === null || observedRemaining === null) return null;
  return {
    expectedTicket,
    remaining: Math.min(observedRemaining, expectedRemaining),
    variance: observedPhysicalTicket - expectedTicket,
    scannedSoldTicket: observedPhysicalTicket !== 0 && observedRemaining > expectedRemaining,
  };
}

/** Preserve the sold/remaining count when switching display direction. */
export function remainingTicketsAfterDirectionChange(
  currentRemaining: number,
  firstTicket: number,
  ticketsPerPack: number,
  direction: "FIRST" | "LAST",
  requestedPhysicalTicket?: number,
): number | null {
  if (requestedPhysicalTicket !== undefined) {
    return remainingTicketsFromPhysicalTicket(
      firstTicket,
      ticketsPerPack,
      requestedPhysicalTicket,
      direction,
    );
  }
  if (!Number.isInteger(currentRemaining) || !Number.isInteger(ticketsPerPack) || ticketsPerPack < 1) return null;
  return Math.min(Math.max(currentRemaining, 0), ticketsPerPack);
}

export function findUnassignedActivePacks(packs: Array<{ serialNumber: string; slot: unknown | null }>): string[] {
  return packs.filter((pack) => !pack.slot).map((pack) => pack.serialNumber);
}
