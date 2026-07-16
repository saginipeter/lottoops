export interface ParsedBarcode {
  gameNumber: string;
  packNumber: string;
  firstTicket: string;
}

/**
 * Parses a lottery pack barcode.
 *
 * Expected format:
 * Game(4) + Pack(7) + FirstTicket(3)
 *
 * Example:
 * 2739002947000
 *
 * Game Number   = 2739
 * Pack Number   = 0029470
 * First Ticket  = 000
 */
export function parseBarcode(barcode: string): ParsedBarcode {
  const cleaned = barcode.replace(/\D/g, "");

  if (cleaned.length < 14) {
    return {
      gameNumber: "",
      packNumber: "",
      firstTicket: "",
    };
  }

  return {
    gameNumber: cleaned.substring(0, 4),
    packNumber: cleaned.substring(4, 11),
    firstTicket: cleaned.substring(11, 14),
  };
}