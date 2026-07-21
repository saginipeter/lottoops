export const TICKET_QUANTITY_PRESETS: Record<number, number> = {
  1: 300,
  2: 150,
  3: 100,
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
