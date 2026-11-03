export interface TicketScanRejection {
  code?: string;
  error?: string;
  status?: number;
}

/** Convert a server rejection into a supportive notice while keeping useful details. */
export function formatTicketScanBlockedMessage({
  code,
  error,
  status,
}: TicketScanRejection): string {
  const reason = error?.trim() ?? "";

  if (code === "SEQUENCE_LOCKED") {
    const expected = reason.match(/expected ticket\s+(\d+)/i)?.[1];
    const scanned = reason.match(/scanned ticket\s+(\d+)/i)?.[1];
    const sequenceDetail = expected && scanned
      ? `The pack expects ticket ${expected}, but ticket ${scanned} was scanned. `
      : "The ticket sequence did not match the pack. ";
    return `We’ve paused this sale to protect the inventory. No ticket was sold. ${sequenceDetail}Please ask a manager to review the ticket sequence before scanning again.`;
  }

  if (code === "BEGINNING_AUDIT_REQUIRED") {
    return "To protect the shift records, this scan is blocked until the opening audit is complete. No ticket was sold. Please ask a manager if you need help.";
  }

  if (code === "STORE_CHANGED") {
    return "This terminal is now connected to a different store, so the scan was blocked and no ticket was sold. Please return to the correct store before scanning again.";
  }

  if (/already scanned|duplicate/i.test(reason)) {
    return "This ticket appears to have been scanned already, so we blocked a duplicate sale. No additional ticket was sold. If this looks incorrect, please ask a manager to check it.";
  }

  if (/no active display pack matches|does not match an active display/i.test(reason)) {
    return "We couldn’t match this ticket to an active display, so it was not sold. Please check the barcode and ask a manager to confirm the pack is active.";
  }

  if (/sold out/i.test(reason)) {
    return "This pack appears to be sold out, so the scan was blocked and no ticket was sold. Please ask a manager to check the pack before continuing.";
  }

  if ((status ?? 0) >= 500 || /failed to check serial number|temporarily unavailable/i.test(reason)) {
    return "We couldn’t confirm the result of this scan. Please check the latest scan and pack status before retrying. If you’re unsure, ask your manager for help.";
  }

  if (reason) {
    return `No ticket was sold. ${reason} If you’re unsure what to do next, please ask a manager for help.`;
  }

  return "We couldn’t verify this ticket, so no sale was recorded. Please check the barcode or ask a manager for help.";
}
