export function canSelfResolveSequenceLock(
  sequenceLocked: boolean,
  expectedTicket: number | null,
  scannedTicket: number | null
): boolean {
  return sequenceLocked && expectedTicket !== null && scannedTicket === expectedTicket;
}

export function canAuthorizeCorrection(role: string): boolean {
  return role === "OWNER" || role === "MANAGER";
}