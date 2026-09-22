export interface ParsedBarcode {
  gameNumber: string;
  packNumber: string;
  firstTicket: string;
}

/**
 * Parses a lottery pack barcode.
 *
 * Expected format:
 * Receiving/live scan: Game(4) + Pack(7) + Ticket(3)
 *
 * Example:
 * 2739002947000
 *
 * Game Number   = 2739
 * Pack Number   = 0029470
 * Ticket suffix = 000 (sample ticket; not the pack's starting ticket)
 */
export function normalizeBarcodeInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 11 ? digits : trimmed;
}

export function isValidPackBarcode(value: string): boolean {
  return normalizeBarcodeInput(value).replace(/\D/g, "").length === 14;
}

export function parseBarcode(barcode: string): ParsedBarcode {
  const cleaned = normalizeBarcodeInput(barcode).replace(/\D/g, "");

  if (cleaned.length !== 14) {
    return {
      gameNumber: "",
      packNumber: "",
      firstTicket: "",
    };
  }

  return {
    gameNumber: cleaned.substring(0, 4),
    packNumber: cleaned.substring(4, 11),
    // A receiving scan may contain ticket 001, 021, 150, etc. That suffix
    // identifies the pack but must not initialize inventory as if that were
    // the pack's first ticket. New packs begin at ticket 1 by default.
    firstTicket: "1",
  };
}
