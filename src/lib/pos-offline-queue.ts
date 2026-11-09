export interface PosQueueEntry {
  id: string;
  barcode: string;
  queuedAt: string;
  attempts: number;
  shiftId?: string;
  loginSessionId?: string;
  state?: "PENDING" | "CONFLICT";
  conflictReason?: string;
}

function isQueueEntry(value: unknown): value is PosQueueEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string" && entry.id.length > 0 &&
    typeof entry.barcode === "string" && /^\d{14}$/.test(entry.barcode) &&
    typeof entry.queuedAt === "string" && Number.isFinite(Date.parse(entry.queuedAt)) &&
    Number.isSafeInteger(entry.attempts) && Number(entry.attempts) >= 0 &&
    (entry.shiftId === undefined || typeof entry.shiftId === "string") &&
    (entry.loginSessionId === undefined || typeof entry.loginSessionId === "string") &&
    (entry.state === undefined || entry.state === "PENDING" || entry.state === "CONFLICT") &&
    (entry.conflictReason === undefined || typeof entry.conflictReason === "string");
}

/**
 * Parse a stored POS queue without discarding malformed content. Invalid data
 * throws so the caller can stop before overwriting a possibly recoverable sale.
 */
export function parsePosOfflineQueue(raw: string | null): PosQueueEntry[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Saved scan queue data is unreadable.");
  }
  if (!Array.isArray(parsed) || !parsed.every(isQueueEntry)) {
    throw new Error("Saved scan queue data is invalid. Preserve it and contact a manager before scanning again.");
  }
  return parsed;
}

export function nextPendingPosQueueEntry(
  entries: PosQueueEntry[],
  volatileConflictIds: ReadonlySet<string> = new Set(),
): PosQueueEntry | undefined {
  return entries.find((entry) => entry.state !== "CONFLICT" && !volatileConflictIds.has(entry.id));
}
