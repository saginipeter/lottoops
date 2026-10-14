import type { ShiftReportData } from "./shift-report";

function recordedNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function recordedString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export function readShiftCashRecord(record: Record<string, unknown> | undefined): {
  terminalId: string | null;
  cash: ShiftReportData["cash"];
} {
  return {
    terminalId: recordedString(record?.terminalId),
    cash: {
      openingCash: recordedNumber(record?.openingCash),
      expectedCash: recordedNumber(record?.expectedCash),
      countedCash: recordedNumber(record?.countedCash),
      cashVariance: recordedNumber(record?.cashVariance),
      reconciledAt: recordedString(record?.cashReconciledAt),
      reconciledBy: recordedString(record?.cashReconciledBy),
    },
  };
}

// JSON extraction tolerates older databases without the dynamic cash columns.
export const SHIFT_REPORT_CASH_QUERY = `
  SELECT s.id, jsonb_build_object(
    'terminalId', to_jsonb(s)->>'terminalId',
    'openingCash', to_jsonb(s)->>'openingCash',
    'expectedCash', to_jsonb(s)->>'expectedCash',
    'countedCash', to_jsonb(s)->>'countedCash',
    'cashVariance', to_jsonb(s)->>'cashVariance',
    'cashReconciledAt', to_jsonb(s)->>'cashReconciledAt',
    'cashReconciledBy', u.name
  ) AS record
  FROM shifts s
  LEFT JOIN users u ON u.id = to_jsonb(s)->>'cashReconciledById' AND u."storeId" = s."storeId"
  WHERE s."storeId" = $1 AND s.id = ANY($2::text[])
`;
