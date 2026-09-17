// Store profit is 5% of ticket sales; the remaining 95% is owed to the state.
export const STORE_PROFIT_RATE = 0.05;
export const STATE_COST_RATE = 0.95;

export function calculateTicketSaleSplit(salesAmount: number) {
  const amount = Number.isFinite(salesAmount) ? salesAmount : 0;
  const profitAmount = Math.round(amount * STORE_PROFIT_RATE * 100) / 100;
  const stateCost = Math.round(amount * STATE_COST_RATE * 100) / 100;
  return { profitAmount, stateCost };
}
