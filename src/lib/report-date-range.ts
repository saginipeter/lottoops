export interface ReportDateRange {
  from: string;
  to: string;
  fromDate: Date;
  toDate: Date;
}

export function defaultReportDateRange(now = new Date()): { from: string; to: string } {
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 30);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

export function parseReportDateRange(
  searchParams: URLSearchParams,
  fallback = defaultReportDateRange(),
): ReportDateRange | { error: string } {
  const from = searchParams.get("from")?.trim() || fallback.from;
  const to = searchParams.get("to")?.trim() || fallback.to;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(from) || !datePattern.test(to)) {
    return { error: "from and to must use YYYY-MM-DD format." };
  }
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59.999`);
  if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) {
    return { error: "from and to must be valid calendar dates." };
  }
  if (fromDate > toDate) return { error: "The start date cannot be after the end date." };
  return { from, to, fromDate, toDate };
}
