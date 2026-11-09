const CUID_TOKEN = /\bcm[a-z0-9]{10,}\b/gi;

/** Hide legacy internal CUIDs when rendering saved report text; source records remain unchanged. */
export function readableReportText(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value
    .replace(/\bduring shift\s+cm[a-z0-9]{10,}\b/gi, "during a shift (number not recorded)")
    .replace(CUID_TOKEN, "related record");
}
