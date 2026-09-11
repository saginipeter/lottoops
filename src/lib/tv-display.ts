export function calculateTicketProgress(
  firstTicket: number,
  currentTicket: number,
  quantity: number
) {
  const sold = Math.max(firstTicket - currentTicket, 0);
  const remaining = Math.max(quantity - sold, 0);
  return { sold, remaining };
}
