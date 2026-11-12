export const ACTIVE_PACK_METADATA_FIELDS = [
  "notes",
  "lotNumber",
  "activationNumber",
  "activationReceipt",
  "activationReceiptPhoto",
  "packImage",
] as const;

export type ActivePackMetadataField = typeof ACTIVE_PACK_METADATA_FIELDS[number];
export type ActivePackMetadataValues = Record<ActivePackMetadataField, string>;
export type ActivePackMetadataPatch = Partial<Record<ActivePackMetadataField, string>>;

/** Return only fields edited in this form so stale, untouched inputs cannot overwrite another manager's update. */
export function changedActivePackMetadata(
  original: ActivePackMetadataValues,
  current: ActivePackMetadataValues,
): ActivePackMetadataPatch {
  return Object.fromEntries(
    ACTIVE_PACK_METADATA_FIELDS
      .filter((field) => original[field] !== current[field])
      .map((field) => [field, current[field]]),
  ) as ActivePackMetadataPatch;
}
