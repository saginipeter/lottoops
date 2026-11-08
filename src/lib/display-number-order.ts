export function compareDisplayNumberLabels(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  const leftLabel = left?.trim() ?? "";
  const rightLabel = right?.trim() ?? "";
  const leftNumber = leftLabel === "" ? Number.NaN : Number(leftLabel);
  const rightNumber = rightLabel === "" ? Number.NaN : Number(rightLabel);
  const leftNumeric = Number.isSafeInteger(leftNumber) && leftNumber >= 0;
  const rightNumeric = Number.isSafeInteger(rightNumber) && rightNumber >= 0;
  const leftBackstock = leftLabel === "" || leftLabel.toLowerCase() === "backstock" || leftLabel.toLowerCase() === "back stock";
  const rightBackstock = rightLabel === "" || rightLabel.toLowerCase() === "backstock" || rightLabel.toLowerCase() === "back stock";

  if (leftBackstock !== rightBackstock) return leftBackstock ? 1 : -1;
  if (leftNumeric && rightNumeric && leftNumber !== rightNumber) return leftNumber - rightNumber;
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return leftLabel.localeCompare(rightLabel, undefined, { numeric: true }) || leftLabel.localeCompare(rightLabel);
}

export function formatDisplayNumberLabel(label: string | null | undefined): string {
  return label?.trim() || "Backstock";
}
