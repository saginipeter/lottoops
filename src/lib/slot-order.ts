export function compareSlotNumbers(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

export function sortBySlotNumber<T extends { slotNumber: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareSlotNumbers(a.slotNumber, b.slotNumber));
}
