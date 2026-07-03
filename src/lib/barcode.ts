export interface ParsedBarcode {
  gameNumber: string;
  packNumber: string;
  firstTicket: string;
}

/**
 * Parses a lottery pack barcode.
 *
 * Expected format:
 * Game(4) + Pack(3) + FirstTicket(3)
 *
 * Example:
 * 273900120000
 *
 * Game Number   = 2739
 * Pack Number   = 001
 * First Ticket  = 000
 */
export function parseBarcode(barcode: string): ParsedBarcode {
  const cleaned = barcode.replace(/\D/g, "");

  if (cleaned.length < 10) {
    return {
      gameNumber: "",
      packNumber: "",
      firstTicket: "",
    };
  }

  return {
    gameNumber: cleaned.substring(0, 4),
    packNumber: cleaned.substring(4, 7),
    firstTicket: cleaned.substring(7, 10),
  };
}