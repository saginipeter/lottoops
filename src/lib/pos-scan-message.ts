export interface TicketScanRejection {
  code?: string;
  error?: string;
  status?: number;
  expectedTicket?: number;
  scannedTicketNumber?: number;
}

/** Convert a server rejection into a supportive notice while keeping useful details. */
export function formatTicketScanBlockedMessage({
  code,
  error,
  status,
  expectedTicket,
  scannedTicketNumber,
}: TicketScanRejection): string {
  const reason = error?.trim() ?? "";

  if (code === "TICKET_SEQUENCE_MISMATCH") {
    const expected = expectedTicket?.toString() ?? reason.match(/expected ticket\s+(\d+)/i)?.[1];
    const scanned = scannedTicketNumber?.toString() ?? reason.match(/scanned ticket\s+(\d+)/i)?.[1] ?? reason.match(/(?:ticket\s+)?(\d+)\s+(?:was\s+)?scanned/i)?.[1];
    const details = expected
      ? ` Expected ticket ${expected}${scanned ? `; ticket ${scanned} was scanned` : ""}.`
      : " Please scan the next expected ticket.";
    return `Wrong ticket scanned in this shift. No ticket was tracked.${details}`;
  }

  if (code === "SEQUENCE_LOCKED") {
    return "This pack needs manager assistance before another ticket can be tracked. No ticket was tracked.";
  }

  if (code === "INVALID_TICKET_NUMBER") {
    return "This barcode has an invalid ticket number. Scan a complete ticket barcode; no ticket was tracked.";
  }

  if (code === "BEGINNING_AUDIT_REQUIRED") {
    return "To protect the shift records, no ticket was tracked because the opening audit is incomplete. Please ask a manager if you need help.";
  }

  if (code === "STORE_CHANGED") {
    return "This terminal is now connected to a different store, so no ticket was tracked. Please return to the correct store before scanning again.";
  }

  if (/already scanned|duplicate/i.test(reason)) {
    return "This ticket appears to have been scanned already. No additional ticket was tracked. If this looks incorrect, please ask a manager to check it.";
  }

  if (/no active display pack matches|does not match an active display/i.test(reason)) {
    return "We couldn’t match this ticket to an active display, so it was not tracked. Please check the barcode and ask a manager to confirm the pack is active.";
  }

  if (/sold out|no tickets remaining/i.test(reason)) {
    return "This pack appears to have no tickets remaining, so no ticket was tracked. Please ask a manager to check the pack before continuing.";
  }

  if ((status ?? 0) >= 500 || /failed to check serial number|temporarily unavailable/i.test(reason)) {
    return "We couldn’t confirm the result of this scan. Please check the latest scan and pack status before retrying. If you’re unsure, ask your manager for help.";
  }

  if (reason) {
    return `No ticket was tracked. ${reason} If you’re unsure what to do next, please ask a manager for help.`;
  }

  return "We couldn’t verify this ticket, so it was not tracked. Please check the barcode or ask a manager for help.";
}
