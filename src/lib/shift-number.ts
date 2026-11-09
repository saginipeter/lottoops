export const SHIFT_NUMBERS = [1, 2] as const;
export type ShiftNumber = (typeof SHIFT_NUMBERS)[number];

export function parseShiftNumber(value: unknown): ShiftNumber | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isInteger(parsed) && SHIFT_NUMBERS.includes(parsed as ShiftNumber)
    ? parsed as ShiftNumber
    : null;
}

export function getNextAvailableShiftNumber(openNumbers: readonly (number | null | undefined)[]): ShiftNumber | null {
  const open = new Set(openNumbers);
  return SHIFT_NUMBERS.find((number) => !open.has(number)) ?? null;
}

export function formatShiftLabel(shiftNumber: number | null | undefined): string {
  return shiftNumber == null ? "Unnumbered shift" : `Shift ${shiftNumber}`;
}
