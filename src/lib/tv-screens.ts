export const TV_SCREEN_COLUMNS = 10;
export const TV_SCREEN_ROWS = 4;
export const TV_SCREEN_CAPACITY = TV_SCREEN_COLUMNS * TV_SCREEN_ROWS;
export const TV_SCREEN_MAX_NUMBER = 10_000;
export const TV_SCREEN_ROTATION_SECONDS = 15;

/** A fixed TV link never silently switches to another screen when inventory shrinks. */
export function parseTvScreenNumber(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") return 1;
  if (typeof value === "string" && !/^[1-9]\d*$/.test(value)) return 1;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= TV_SCREEN_MAX_NUMBER ? number : 1;
}

/** Natural display order, with every real entry assigned exactly once to a 40-card screen. */
export function splitTvScreens<T extends { slotNumber: string }>(slots: readonly T[]): T[][] {
  const ordered = [...slots].sort((left, right) =>
    left.slotNumber.localeCompare(right.slotNumber, "en", { numeric: true }) ||
    left.slotNumber.localeCompare(right.slotNumber, "en"),
  );
  const screens: T[][] = [];
  for (let index = 0; index < ordered.length; index += TV_SCREEN_CAPACITY) {
    screens.push(ordered.slice(index, index + TV_SCREEN_CAPACITY));
  }
  return screens.length > 0 ? screens : [[]];
}
