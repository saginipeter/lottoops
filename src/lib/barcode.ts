export interface ParsedBarcode {
  gameNumber: string;
  packNumber: string;
  firstTicket: string;
}

/**
 * Parses a lottery pack barcode.
 *
 * Expected format:
 * Receiving: Game(4) + Pack(7) [+ optional Ticket(3)]
 *
 * Example:
 * 2739002947000
 *
 * Game Number   = 2739
 * Pack Number   = 0029470
 * First Ticket  = 000
 */
export function normalizeBarcodeInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 11 ? digits : trimmed;
}

export function parseBarcode(barcode: string): ParsedBarcode {
  const cleaned = normalizeBarcodeInput(barcode).replace(/\D/g, "");

  if (cleaned.length < 11) {
    return {
      gameNumber: "",
      packNumber: "",
      firstTicket: "",
    };
  }

  return {
    gameNumber: cleaned.substring(0, 4),
    packNumber: cleaned.substring(4, 11),
    firstTicket: cleaned.length >= 14 ? cleaned.substring(11, 14) : "000",
  };
}