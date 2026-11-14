function recordedNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function recordedString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export function readShiftRegisterSalesRecord(record: Record<string, unknown> | undefined) {
  return {
    registerScratchOffSales: recordedNumber(record?.registerScratchOffSales),
    registerSalesRecordedAt: recordedString(record?.registerSalesRecordedAt),
    registerSalesRecordedBy: recordedString(record?.registerSalesRecordedBy),
  };
}

// JSON extraction tolerates databases that have not yet received the additive migration.
// Historical drawer-cash columns are intentionally never selected or returned.
export const SHIFT_REPORT_REGISTER_SALES_QUERY = `
  SELECT s.id, jsonb_build_object(
    'registerScratchOffSales', to_jsonb(s)->>'registerScratchOffSales',
    'registerSalesRecordedAt', to_jsonb(s)->>'registerScratchOffSalesRecordedAt',
    'registerSalesRecordedBy', u.name
  ) AS record
  FROM shifts s
  LEFT JOIN users u ON u.id = to_jsonb(s)->>'registerScratchOffSalesRecordedById' AND u."storeId" = s."storeId"
  WHERE s."storeId" = $1 AND s.id = ANY($2::text[])
`;
