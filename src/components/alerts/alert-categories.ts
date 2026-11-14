export type AlertCategory = "ALL" | "LOW_STOCK" | "SHIPMENT" | "SECURITY" | "SYSTEM" | "RETURN" | "TICKET" | "AUDIT";
export type AlertSort = "SEVERITY" | "NEWEST" | "OLDEST";

export const alertCategories: Array<{ id: AlertCategory; label: string }> = [
  { id: "ALL", label: "All alerts" },
  { id: "LOW_STOCK", label: "Low stock" },
  { id: "SHIPMENT", label: "Shipment overrides & receiving" },
  { id: "SECURITY", label: "Security warnings" },
  { id: "SYSTEM", label: "System errors & devices" },
  { id: "RETURN", label: "Return requests" },
  { id: "TICKET", label: "Ticket exceptions" },
  { id: "AUDIT", label: "Audit discrepancies" },
];

export function getAlertCategory(type: string): AlertCategory {
  if (type === "LOW_TICKETS") return "LOW_STOCK";
  if (type === "STALE_RECEIVING" || type === "SHIPMENT_OVERRIDE" || type === "DUPLICATE_PACK") return "SHIPMENT";
  if (type === "INCOMPLETE_AUDIT" || type === "INVENTORY_AUDIT_VARIANCE" || type === "PACK_UPDATE") return "AUDIT";
  if (type === "SECURITY" || type.startsWith("SECURITY_")) return "SECURITY";
  if (type === "RETURN_REQUEST" || type === "TICKET_RETURN_REVIEW") return "RETURN";
  if (type === "TICKET_EXCEPTION" || type === "EXPECTED_TICKET_MISMATCH" || type === "WRONG_PACK_OR_GAME") return "TICKET";
  return "SYSTEM";
}

export interface AlertResolutionGuidance {
  steps: string[];
  href?: string;
  linkLabel?: string;
}

export function getAlertResolutionGuidance(type: string): AlertResolutionGuidance {
  if (type === "LOW_TICKETS") return {
    steps: ["Check the pack and ticket count at the named display.", "Prepare a replacement pack from Back Stock before the display runs out."],
    href: "/inventory/active", linkLabel: "Open Active Stock",
  };
  if (type === "INCOMPLETE_AUDIT") return {
    steps: ["Open the shift shown in this alert.", "Complete the missing physical ticket scans, then finish the audit."],
    href: "/shifts", linkLabel: "Open Shifts",
  };
  if (type === "INVENTORY_AUDIT_VARIANCE") return {
    steps: ["Recount the tickets in the named pack.", "Compare the physical count with the audit and record an explanation before making any stock correction."],
    href: "/shifts", linkLabel: "Review Shift Audits",
  };
  if (type === "TICKET_EXCEPTION" || type === "EXPECTED_TICKET_MISMATCH") return {
    steps: ["No ticket was tracked for the wrong ticket scan.", "Check the expected ticket number and scan that ticket next. Review the pack and shift if the numbers still do not match."],
    href: "/shifts", linkLabel: "Review Shifts",
  };
  if (type === "WRONG_PACK_OR_GAME") return {
    steps: ["No ticket was tracked because the barcode did not match an active display pack.", "Check the barcode and the Pack # / Game # on the ticket, then verify that the correct pack is active on the correct display."],
    href: "/inventory/active", linkLabel: "Open Active Stock",
  };
  if (type === "PACK_UPDATE") return {
    steps: ["Review which pack details changed and the reason recorded by the manager.", "If the change looks wrong, verify the pack against its receipt or physical label and follow your correction process."],
    href: "/reports", linkLabel: "Open Reports",
  };
  if (type === "DUPLICATE_PACK") return {
    steps: ["Do not receive the same pack again.", "Find the existing Pack # in Active Stock or Back Stock and compare it with the shipment paperwork."],
    href: "/inventory/back-stock", linkLabel: "Open Back Stock",
  };
  if (type === "STALE_RECEIVING") return {
    steps: ["Open the receiving draft and compare scanned packs with the invoice.", "Finish receiving or correct the draft through the normal shipment workflow."],
    href: "/inventory/receive", linkLabel: "Open Receive Shipment",
  };
  if (type === "SHIPMENT_OVERRIDE") return {
    steps: ["Compare the expected pack count with the count recorded when the override was approved.", "Check the invoice and receiving records; do not change the historical approval to hide a difference."],
    href: "/reports", linkLabel: "Open Reports",
  };
  if (type === "DEVICE_HEALTH") return {
    steps: ["Check that the named terminal is powered on and connected to the store network.", "Open device settings to confirm that it is active and paired, then check in again."],
    href: "/settings", linkLabel: "Open Device Settings",
  };
  if (type === "TICKET_RETURN_REVIEW" || type === "RETURN_REQUEST") return {
    steps: ["Open Ticket Return Requests below and compare the ticket, Pack #, reason, and shift.", "Approve or flag the review only after checking the details; the action shown there controls whether inventory changes."],
    href: "/alerts", linkLabel: "Open Alerts",
  };
  return {
    steps: ["Open the related shift, shipment, or inventory record and check the details shown here.", "Do not change stock or clear the alert until the physical record has been checked."],
    href: "/alerts", linkLabel: "Open Alerts",
  };
}

export function filterAndSortAlerts<T extends { type: string; severity: string; createdAt: string }>(
  alerts: T[], category: AlertCategory, sort: AlertSort,
): T[] {
  const severity: Record<string, number> = { CRITICAL: 5, URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
  const timestamp = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return alerts.filter((alert) => category === "ALL" || getAlertCategory(alert.type) === category).sort((a, b) => {
    const newestFirst = timestamp(b.createdAt) - timestamp(a.createdAt);
    if (sort === "OLDEST") return -newestFirst;
    if (sort === "NEWEST") return newestFirst;
    return (severity[b.severity] ?? -1) - (severity[a.severity] ?? -1) || newestFirst;
  });
}
