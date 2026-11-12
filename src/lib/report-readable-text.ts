const CUID_TOKEN = /\bcm[a-z0-9]{10,}\b/gi;

/** Hide legacy internal CUIDs when rendering saved report text; source records remain unchanged. */
export function readableReportText(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value
    .replace(/\bduring shift\s+cm[a-z0-9]{10,}\b/gi, "during a shift (number not recorded)")
    .replace(CUID_TOKEN, "related record");
}

/** Replace legacy audit details that embedded a Pack CUID with the human pack and game labels. */
export function readablePackReferenceText(
  value: string | null | undefined,
  packNumber: string | null | undefined,
  gameNumber: string | null | undefined,
): string | null {
  if (value == null) return null;
  const packLabel = `Pack #${packNumber?.trim() || "not recorded"} · Game #${gameNumber?.trim() || "not recorded"}`;
  return readableReportText(value.replace(/\bPack\s+#?cm[a-z0-9]{10,}\b/gi, packLabel));
}
