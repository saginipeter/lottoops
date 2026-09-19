export const EMPLOYEE_SELF_RETURN_WINDOW_MS = 2 * 60 * 1000;
export const EMPLOYEE_SELF_RETURN_LIMIT = 3;

export function canEmployeeSelfReturn({
  role,
  requestedBarcode,
  latestBarcode,
  latestScannedAt,
  priorSelfReturns,
  now = new Date(),
}: {
  role: string;
  requestedBarcode: string;
  latestBarcode: string | null;
  latestScannedAt: Date | null;
  priorSelfReturns: number;
  now?: Date;
}): boolean {
  if (role !== "EMPLOYEE") return false;
  if (!requestedBarcode || requestedBarcode !== latestBarcode) return false;
  if (!latestScannedAt || priorSelfReturns >= EMPLOYEE_SELF_RETURN_LIMIT) return false;

  const ageMs = now.getTime() - latestScannedAt.getTime();
  return ageMs >= 0 && ageMs <= EMPLOYEE_SELF_RETURN_WINDOW_MS;
}
