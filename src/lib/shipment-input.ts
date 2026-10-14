export function shipmentMetadataInput(body: Record<string, unknown>) {
  const result: { supplierName?: string | null; supplierDetails?: string | null; expectedInventoryCost?: number | null } = {};
  for (const [key, limit] of [["supplierName", 200], ["supplierDetails", 2000]] as const) {
    if (body[key] === undefined) continue;
    if (body[key] !== null && typeof body[key] !== "string") throw new Error(`${key} must be text.`);
    const value = (body[key] as string | null)?.trim() || null;
    if (value && value.length > limit) throw new Error(`${key} must be at most ${limit} characters.`);
    result[key] = value;
  }
  if (body.expectedRetailValue !== undefined) {
    const value = body.expectedRetailValue === null ? null : Number(body.expectedRetailValue);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) throw new Error("Expected inventory cost must be greater than zero.");
    result.expectedInventoryCost = value === null ? null : Math.round(value * 100) / 100;
  }
  return result;
}
