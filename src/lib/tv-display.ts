export function calculateTicketProgress(
  _firstTicket: number,
  remainingTicketCount: number,
  quantity: number
) {
  const safeQuantity = Math.max(Number(quantity) || 0, 0);
  const remaining = Math.min(Math.max(Number(remainingTicketCount) || 0, 0), safeQuantity);
  const sold = Math.max(safeQuantity - remaining, 0);
  return { sold, remaining };
}

export function getDisplayedTicketNumber(
  firstTicket: number,
  remainingTicketCount: number,
  quantity: number,
  direction?: string | null,
): number {
  const first = Math.max(Number(firstTicket) || 1, 1);
  const safeQuantity = Math.max(Number(quantity) || 0, 0);
  const remaining = Math.min(Math.max(Number(remainingTicketCount) || 0, 0), safeQuantity);
  if (direction === "LAST") return remaining;
  const initialRemaining = Math.max(safeQuantity - first + 1, 0);
  return initialRemaining > 0 ? first + Math.max(initialRemaining - remaining, 0) : 0;
}

export function getNextDisplayedTicket(
  firstTicket: number,
  remainingTicketCount: number,
  quantity: number,
  direction?: string | null,
): number {
  const current = getDisplayedTicketNumber(firstTicket, remainingTicketCount, quantity, direction);
  if (direction === "LAST") return current > 1 ? current - 1 : 0;
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
