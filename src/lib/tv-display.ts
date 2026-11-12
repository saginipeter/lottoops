export function calculateTicketProgress(
  firstTicket: number,
  remainingTicketCount: number,
  quantity: number
) {
  const safeQuantity = Math.max(Number(quantity) || 0, 0);
  const first = Math.max(Number(firstTicket) || 1, 1);
  const available = Math.max(safeQuantity - first + 1, 0);
  const remaining = Math.min(Math.max(Number(remainingTicketCount) || 0, 0), available);
  const sold = Math.max(available - remaining, 0);
  return { sold, remaining };
}

export function getDisplayRemainingTicketCount(
  currentTicketNumber: number | null | undefined,
  firstTicket: number,
  quantity: number,
  _direction?: string | null,
): number {
  const safeQuantity = Math.max(Number(quantity) || 0, 0);
  const first = Math.max(Number(firstTicket) || 1, 1);
  const available = Math.max(safeQuantity - first + 1, 0);
  // The sell direction changes the displayed physical ticket, not the sellable count.
  void _direction;
  const current = Number(currentTicketNumber);
  if (currentTicketNumber !== null && currentTicketNumber !== undefined && Number.isFinite(current)) {
    return Math.min(Math.max(current, 0), available);
  }

  return available;
}

export function getDisplayedTicketNumber(
  firstTicket: number,
  remainingTicketCount: number,
  quantity: number,
  direction?: string | null,
): number {
  const first = Math.max(Number(firstTicket) || 1, 1);
  const safeQuantity = Math.max(Number(quantity) || 0, 0);
  const available = Math.max(safeQuantity - first + 1, 0);
  const remaining = Math.min(Math.max(Number(remainingTicketCount) || 0, 0), available);
  if (remaining === 0) return 0;
  if (direction === "LAST") return first + remaining - 1;
  return available > 0 ? first + Math.max(available - remaining, 0) : 0;
}

export function getNextDisplayedTicket(
  firstTicket: number,
  remainingTicketCount: number,
  quantity: number,
  direction?: string | null,
): number {
  const current = getDisplayedTicketNumber(firstTicket, remainingTicketCount, quantity, direction);
  if (direction === "LAST") return current > Math.max(Number(firstTicket) || 1, 1) ? current - 1 : 0;
  const first = Math.max(Number(firstTicket) || 1, 1);
  const safeQuantity = Math.max(Number(quantity) || 0, 0);
  const last = first + Math.max(safeQuantity - first, 0);
  return current > 0 && current < last ? current + 1 : 0;
}

export function getRemainingTicketCount(currentTicketNumber: number | null, quantity: number | null): number {
  const safeQuantity = Math.max(Number(quantity) || 0, 0);
  return Math.min(Math.max(Number(currentTicketNumber) || 0, 0), safeQuantity);
}

export function getSoldTicketCount(currentTicketNumber: number | null, quantity: number | null): number {
  const remaining = getRemainingTicketCount(currentTicketNumber, quantity);
  return Math.max(Number(quantity) || 0, 0) - remaining;
}
