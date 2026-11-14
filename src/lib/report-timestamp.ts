const DEFAULT_REPORT_TIME_ZONE = "America/Chicago";

function asValidDate(value: unknown): Date | null {
  if (!(typeof value === "string" || value instanceof Date)) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Format an instant for report display without changing the stored/API value. */
export function formatReportTimestamp(
  value: unknown,
  timeZone = DEFAULT_REPORT_TIME_ZONE,
): string {
  const date = asValidDate(value);
  if (!date) return "Not recorded";

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
    timeZone,
  };
  try {
    return new Intl.DateTimeFormat("en-US", options).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: DEFAULT_REPORT_TIME_ZONE,
    }).format(date);
  }
}

/** Format a calendar date while avoiding timezone drift for date-only ISO values. */
export function formatReportDate(value: unknown): string {
  if (typeof value !== "string") return "Not recorded";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "Not recorded";
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
