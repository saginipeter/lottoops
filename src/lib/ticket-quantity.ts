import { physicalTicketFromRemaining } from "@/lib/core-validation";

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

export function getSafeCurrentTicket({
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

  const finiteCurrent = Number.isFinite(current) && current > 0 ? current : 0;
  const finiteFirst = Number.isFinite(first) && first > 0 ? first : 0;
  const finiteQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const initialRemaining =
    finiteFirst > 0 && finiteQuantity >= finiteFirst
      ? finiteQuantity - finiteFirst + 1
      : finiteQuantity;

  if (finiteCurrent > 0 && initialRemaining > 0 && finiteCurrent <= initialRemaining) {
    return finiteCurrent;
  }

  if (initialRemaining > 0) {
    return initialRemaining;
  }

  if (finiteCurrent > 0) {
    return finiteCurrent;
  }

  if (finiteFirst > 0) {
    return finiteFirst;
  }

  return 0;
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
  return getSafeCurrentTicket({
    currentTicketNumber,
    firstTicket,
    ticketQuantity,
  });
}

export function getValidTicketState({
  currentTicketNumber,
  firstTicket,
  ticketQuantity,
}: {
  currentTicketNumber: number | null;
  firstTicket: number | null;
  ticketQuantity: number | null;
}): { currentTicketNumber: number; firstTicket: number; ticketQuantity: number } {
  const quantity = Number(ticketQuantity ?? 0);
  const first = Number(firstTicket ?? 0);
  const current = Number(currentTicketNumber ?? 0);

  const resolvedQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const resolvedFirstTicket =
    Number.isFinite(first) && first > 0 && (resolvedQuantity <= 0 || first <= resolvedQuantity)
      ? first
      : resolvedQuantity > 0
        ? 1
        : 0;
  const resolvedCurrentTicket =
    Number.isFinite(current) && current > 0
      ? current
      : resolvedFirstTicket;

  const safeCurrent =
    resolvedQuantity > 0 && resolvedCurrentTicket > resolvedQuantity
      ? resolvedQuantity
      : resolvedCurrentTicket;

  return {
    currentTicketNumber: safeCurrent,
    firstTicket: resolvedFirstTicket,
    ticketQuantity: resolvedQuantity,
  };
}

export function getAuditPhysicalTicket({
  currentTicketNumber,
  firstTicket,
  ticketQuantity,
}: {
  currentTicketNumber: number | null;
  firstTicket: number | null;
  ticketQuantity: number | null;
}): number {
  const rawCurrent = Number(currentTicketNumber ?? 0);
  if (Number.isFinite(rawCurrent) && rawCurrent === 0 && currentTicketNumber !== null) return 0;

  const state = getValidTicketState({ currentTicketNumber, firstTicket, ticketQuantity });
  const remaining = getSafeCurrentTicket({ currentTicketNumber, firstTicket, ticketQuantity });
  if (state.ticketQuantity <= 0 || remaining <= 0) return 0;

  return physicalTicketFromRemaining(
    state.firstTicket || 1,
    state.ticketQuantity,
    remaining
  ) ?? 0;
}
