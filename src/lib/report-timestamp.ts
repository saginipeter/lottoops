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

/** Return an instant's calendar date in the report timezone as YYYY-MM-DD. */
export function reportDateKey(
  value: unknown,
  timeZone = DEFAULT_REPORT_TIME_ZONE,
): string | null {
  const date = asValidDate(value);
  if (!date) return null;

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", options).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: DEFAULT_REPORT_TIME_ZONE,
    }).formatToParts(date);
  }
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  if (!values.year || !values.month || !values.day) return null;
  return `${values.year.padStart(4, "0")}-${values.month}-${values.day}`;
}

/** Format an instant's calendar date in the report timezone. */
export function formatReportInstantDate(value: unknown): string {
  const key = reportDateKey(value);
  return key ? formatReportDate(key) : "Not recorded";
}

/** Convert a report calendar date to its first instant in the report timezone. */
export function startOfReportDate(
  value: unknown,
  timeZone = DEFAULT_REPORT_TIME_ZONE,
): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const targetAsUtc = Date.UTC(year, month - 1, day);
  const normalized = new Date(targetAsUtc);
  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() + 1 !== month ||
    normalized.getUTCDate() !== day
  ) return null;

  let formatter: Intl.DateTimeFormat;
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23", timeZone,
  };
  try {
    formatter = new Intl.DateTimeFormat("en-US", options);
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", { ...options, timeZone: DEFAULT_REPORT_TIME_ZONE });
  }

  let candidate = targetAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidate)).map(({ type, value: part }) => [type, part]),
    );
    const localAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    const correction = targetAsUtc - localAsUtc;
    candidate += correction;
    if (correction === 0) break;
  }
  return new Date(candidate);
}

/** Convert a report calendar date to its final millisecond in the report timezone. */
export function endOfReportDate(
  value: unknown,
  timeZone = DEFAULT_REPORT_TIME_ZONE,
): Date | null {
  const start = startOfReportDate(value, timeZone);
  if (!start || typeof value !== "string") return null;
  const [year, month, day] = value.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  const nextStart = startOfReportDate(nextDate, timeZone);
  return nextStart ? new Date(nextStart.getTime() - 1) : null;
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
