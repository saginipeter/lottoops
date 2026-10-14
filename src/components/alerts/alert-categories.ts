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
  if (type === "STALE_RECEIVING" || type === "SHIPMENT_OVERRIDE") return "SHIPMENT";
  if (type === "INCOMPLETE_AUDIT" || type === "INVENTORY_AUDIT_VARIANCE") return "AUDIT";
  if (type === "SECURITY" || type.startsWith("SECURITY_")) return "SECURITY";
  if (type === "RETURN_REQUEST") return "RETURN";
  if (type === "TICKET_EXCEPTION") return "TICKET";
  return "SYSTEM";
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
