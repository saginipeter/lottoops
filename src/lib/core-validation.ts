export function validateEndingTicket(beginningTicket: number, endingTicket: number): string | null {
  if (!Number.isInteger(beginningTicket) || beginningTicket < 0) {
    return "Beginning ticket must be a non-negative integer.";
  }
  if (!Number.isInteger(endingTicket) || endingTicket < 0 || endingTicket > beginningTicket) {
    return `Ending ticket must be an integer from 0 through ${beginningTicket}.`;
  }
  return null;
}

export function findUnassignedActivePacks(
  packs: Array<{ serialNumber: string; slot: unknown | null }>
): string[] {
  return packs.filter((pack) => !pack.slot).map((pack) => pack.serialNumber);
}