export function canReturnLatestTicket({
  role,
  requestedBarcode,
  latestBarcode,
}: {
  role: string;
  requestedBarcode: string;
  latestBarcode: string | null;
}): boolean {
  return ["EMPLOYEE", "SHIFT_LEAD", "MANAGER", "OWNER"].includes(role) &&
    Boolean(requestedBarcode) && requestedBarcode === latestBarcode;
}
