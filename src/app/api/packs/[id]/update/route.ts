import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";

const editableFields = ["notes", "lotNumber", "activationNumber", "activationReceipt", "activationReceiptPhoto", "packImage"] as const;
type EditableField = typeof editableFields[number];
type MetadataValue = string | null;

function normalizeValue(field: EditableField, value: unknown): MetadataValue | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${field} must be text or blank.`);
  const normalized = value.trim();
  if (!normalized) return null;
  const maxLength = ["activationReceipt", "activationReceiptPhoto", "packImage"].includes(field) ? 2048 : 2000;
  if (normalized.length > maxLength) throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  if (["activationReceipt", "activationReceiptPhoto", "packImage"].includes(field)) {
    let parsed: URL;
    try { parsed = new URL(normalized); } catch { throw new Error(`${field} must be a valid HTTPS link.`); }
    if (parsed.protocol !== "https:") throw new Error(`${field} must be a valid HTTPS link.`);
  }
  return normalized;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager or owner access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || Array.isArray(body)) return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  const unknownKeys = Object.keys(body).filter((key) => key !== "reason" && !editableFields.includes(key as EditableField));
  if (unknownKeys.length > 0) return NextResponse.json({ error: "Only approved pack metadata fields can be updated." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 6 || reason.length > 1000) return NextResponse.json({ error: "A clear update reason of 6 to 1000 characters is required." }, { status: 400 });

  const data: Partial<Record<EditableField, MetadataValue>> = {};
  try {
    for (const field of editableFields) {
      const value = normalizeValue(field, body[field]);
      if (value !== undefined) data[field] = value;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid pack metadata." }, { status: 400 });
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Choose at least one pack metadata field to update." }, { status: 400 });

  try {
    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const locked = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM packs WHERE id = $1 AND "storeId" = $2 FOR UPDATE`, id, session.storeId,
      );
      if (locked.length === 0) return { error: "Pack not found." as const, status: 404 as const };
      const pack = await tx.pack.findFirst({
        where: { id, storeId: session.storeId },
        include: { game: { select: { name: true, gameNumber: true } }, slot: { select: { slotNumber: true } } },
      });
      if (!pack) return { error: "Pack not found." as const, status: 404 as const };
      if (pack.status !== "ACTIVE") return { error: "Update This Pack is only available for active packs." as const, status: 409 as const };

      const changed = Object.entries(data).filter(([field, value]) => pack[field as EditableField] !== value) as Array<[EditableField, MetadataValue]>;
      if (changed.length === 0) return { unchanged: true as const };
      const updatedPack = await tx.pack.update({ where: { id: pack.id }, data, select: { id: true, packNumber: true, serialNumber: true } });
      const nowKey = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      for (const [field, value] of changed) {
        const oldValue = pack[field] == null ? null : String(pack[field]);
        await tx.$executeRawUnsafe(`
          INSERT INTO inventory_correction_logs
            (id, store_id, entity_type, entity_id, field_name, old_value, new_value, reason, corrected_by_id, corrected_by_name)
          VALUES ($1, $2, 'PACK', $3, $4, $5, $6, $7, $8, $9)
        `, `pack_update_${nowKey}_${field}`, session.storeId, pack.id, field, oldValue, value ?? "", reason, session.userId, session.name);
      }
      const changedFields = changed.map(([field]) => field).join(", ");
      await tx.$executeRawUnsafe(`
        INSERT INTO inventory_activity_logs
          (store_id, action, entity_type, entity_id, detail, performed_by_id, performed_by_name)
        VALUES ($1, 'PACK_UPDATE', 'PACK', $2, $3, $4, $5)
      `, session.storeId, pack.id,
      `Pack ${pack.packNumber ?? pack.serialNumber} · Game ${pack.game.gameNumber}: updated ${changedFields}. Reason: ${reason}`,
      session.userId, session.name);

      const eventKey = `PACK_UPDATE:${pack.id}:${nowKey}`;
      await tx.$executeRawUnsafe(`
        INSERT INTO inventory_notifications
          (id, store_id, notification_type, entity_id, event_key, pack_id, title, detail, severity)
        VALUES ($1, $2, 'PACK_UPDATE', $3, $4, $5, 'Pack updated', $6, 'MEDIUM')
      `, `notification_pack_update_${nowKey}`, session.storeId, pack.id, eventKey, pack.id,
      `${session.name} updated Pack ${pack.packNumber ?? pack.serialNumber} · Game ${pack.game.gameNumber} at Display ${pack.slot?.slotNumber ?? "—"}. Updated fields: ${changedFields}. Reason: ${reason}`);
      return { updatedPack, changedFields };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if ("error" in updated) return NextResponse.json({ error: updated.error }, { status: updated.status });
    return NextResponse.json({ success: true, unchanged: "unchanged" in updated, pack: "updatedPack" in updated ? updated.updatedPack : undefined });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Pack inventory changed during the update. Refresh and try again." }, { status: 409 });
    }
    console.error("[POST /api/packs/:id/update]", error);
    return NextResponse.json({ error: "Unable to update pack metadata." }, { status: 500 });
  }
}
