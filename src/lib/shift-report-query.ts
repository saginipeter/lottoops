export function shiftReportWhere(storeId: string, shiftId: string | null, fromDate: Date, toDate: Date) {
  return {
    storeId,
    status: "CLOSED" as const,
    ...(shiftId ? { id: shiftId } : { closedAt: { gte: fromDate, lte: toDate } }),
  };
}
