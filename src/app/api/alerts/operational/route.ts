import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";
import { ensureDeviceRegistrySchema } from "@/lib/device-registry";

interface LowTicketPack { id: string; serialNumber: string; packNumber: string | null; currentTicketNumber: number | null; slot: { slotNumber: string } | null; game: { name: string; gameNumber: string } }
interface OpenShift { id: string; openedAt: Date; openedBy: { name: string }; inventoryAudit: { id: string; status: string; lines: Array<{ packId: string; beginningPhysicalTicket: number | null; endingPhysicalTicket: number | null }> } | null }
interface StaleShipment { id: string; invoiceNumber: string; createdAt: Date; expectedPacks: number }
interface InventoryNotification { id: string; notificationType: string; title: string; detail: string; severity: string; createdAt: Date; entityId: string; packNumber: string | null; gameNumber: string | null }

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const [packsResult, shiftsResult, shipmentsResult, activePackResult] = await Promise.all([
      prisma.pack.findMany({
        where: { storeId: session.storeId, status: "ACTIVE", slot: { isNot: null }, currentTicketNumber: { lte: 5 } },
        select: { id: true, serialNumber: true, packNumber: true, currentTicketNumber: true, slot: { select: { slotNumber: true } }, game: { select: { name: true, gameNumber: true } } },
        orderBy: { currentTicketNumber: "asc" },
      }),
      prisma.shift.findMany({
        where: { storeId: session.storeId, status: "OPEN" },
        select: { id: true, openedAt: true, openedBy: { select: { name: true } }, inventoryAudit: { select: { id: true, status: true, lines: { select: { packId: true, beginningPhysicalTicket: true, endingPhysicalTicket: true } } } } },
      }),
      prisma.shipment.findMany({
        where: { storeId: session.storeId, status: "IN_PROGRESS", createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        select: { id: true, invoiceNumber: true, createdAt: true, expectedPacks: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.pack.findMany({ where: { storeId: session.storeId, status: "ACTIVE", slot: { isNot: null } }, select: { id: true } }),
    ]);
    let deviceRows: Array<{ id: string; terminalId: string; lastSeenAt: Date | null; healthStatus: string; active: boolean; isPaired: boolean }> = [];
    try {
      await ensureDeviceRegistrySchema();
      deviceRows = await prisma.$queryRawUnsafe(`
        SELECT id, terminal_id AS "terminalId", last_seen_at AS "lastSeenAt", active,
          (device_key_hash IS NOT NULL) AS "isPaired",
          CASE
            WHEN active = FALSE THEN 'INACTIVE'
            WHEN last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '15 minutes' THEN 'OFFLINE'
            WHEN last_seen_at < NOW() - INTERVAL '5 minutes' THEN 'STALE'
            ELSE 'ONLINE'
          END AS "healthStatus"
        FROM store_devices WHERE store_id = $1 ORDER BY terminal_id ASC
      `, session.storeId) as typeof deviceRows;
    } catch {
      // Device registry is optional for legacy stores.
    }
    const packs = packsResult as LowTicketPack[];
    const shifts = shiftsResult as OpenShift[];
    const shipments = shipmentsResult as StaleShipment[];
    const activePackRows = activePackResult as Array<{ id: string }>;
    let notifications: InventoryNotification[] = [];
    let shipmentOverrides: Array<{ id: string; detail: string; createdAt: Date; entityId: string }> = [];
    let clearedAlertKeys: string[] = [];
    try {
      notifications = await prisma.$queryRawUnsafe(`
        SELECT n.id, n.notification_type AS "notificationType", n.title, n.detail, n.severity,
               n.created_at AS "createdAt", n.entity_id AS "entityId",
               COALESCE(p."packNumber", p."serialNumber") AS "packNumber", g."gameNumber" AS "gameNumber"
        FROM inventory_notifications n
        LEFT JOIN inventory_audit_lines audit_line ON audit_line.id = n.entity_id
        LEFT JOIN packs p ON p.id = COALESCE(n.pack_id, audit_line."packId", n.entity_id)
        LEFT JOIN games g ON g.id = p."gameId"
        WHERE n.store_id = $1 ORDER BY n.created_at DESC LIMIT 100`, session.storeId) as typeof notifications;
    } catch {
      // Notifications are created lazily when an audit variance is found.
    }
    try {
      shipmentOverrides = await prisma.$queryRawUnsafe(
        `SELECT id, detail, created_at AS "createdAt", entity_id AS "entityId"
         FROM inventory_activity_logs
         WHERE store_id = $1 AND action = 'SHIPMENT_OVERRIDE'
         ORDER BY created_at DESC LIMIT 50`,
        session.storeId
      ) as typeof shipmentOverrides;
    } catch {
      // Legacy databases may not have the activity log table initialized.
    }
    const alerts = [
      ...packs.map((pack) => ({ id: `LOW_TICKETS_${pack.id}`, alertKey: `LOW_TICKETS:${pack.id}`, type: "LOW_TICKETS", severity: "HIGH", title: "Low tickets remaining", packNumber: pack.packNumber ?? pack.serialNumber, gameNumber: pack.game.gameNumber, detail: `${pack.game.name} at display ${pack.slot?.slotNumber ?? "-"} has ${pack.currentTicketNumber ?? 0} ticket(s) remaining.`, createdAt: new Date().toISOString(), entityId: pack.id })),
      ...shifts.flatMap((shift) => {
        const audit = shift.inventoryAudit;
        if (audit?.status === "COMPLETED" || activePackRows.length === 0) return [];
        const openingIncomplete = !audit || activePackRows.some((pack) => !audit.lines.some((line) => line.packId === pack.id && line.beginningPhysicalTicket !== null));
        const stage = openingIncomplete ? "Opening Audit" : "Closing Audit";
        const incomplete = activePackRows.filter((pack) => !audit?.lines.some((line) => line.packId === pack.id && (openingIncomplete ? line.beginningPhysicalTicket : line.endingPhysicalTicket) !== null)).length;
        const detail = incomplete > 0
          ? `${incomplete} ${stage.toLowerCase()} scan(s) remain incomplete for the shift opened by ${shift.openedBy.name}.`
          : `All active display packs have been scanned; the ${stage.toLowerCase()} is ready to complete for the shift opened by ${shift.openedBy.name}.`;
        return [{ id: `AUDIT_${shift.id}`, alertKey: `AUDIT:${shift.id}`, type: "INCOMPLETE_AUDIT", severity: "URGENT", title: `${stage} incomplete`, detail, createdAt: shift.openedAt.toISOString(), entityId: shift.id }];
      }),
      ...shipments.map((shipment) => ({ id: `SHIPMENT_${shipment.id}`, alertKey: `SHIPMENT:${shipment.id}`, type: "STALE_RECEIVING", severity: "MEDIUM", title: "Receiving draft is overdue", detail: `Invoice ${shipment.invoiceNumber} has been in progress for more than 24 hours (${shipment.expectedPacks} expected pack(s)).`, createdAt: shipment.createdAt.toISOString(), entityId: shipment.id })),
      ...notifications.map((notification) => ({ id: `NOTIFICATION_${notification.id}`, alertKey: `NOTIFICATION:${notification.id}`, type: notification.notificationType, severity: notification.severity, title: notification.title, detail: notification.detail, packNumber: notification.packNumber, gameNumber: notification.gameNumber, createdAt: notification.createdAt.toISOString(), entityId: notification.entityId })),
      ...shipmentOverrides.map((entry) => ({ id: `SHIPMENT_OVERRIDE_${entry.id}`, alertKey: `SHIPMENT_OVERRIDE:${entry.id}`, type: "SHIPMENT_OVERRIDE", severity: "MEDIUM", title: "Shipment override approved", detail: entry.detail, createdAt: entry.createdAt.toISOString(), entityId: entry.entityId })),
      ...deviceRows.filter((device) => device.healthStatus === "OFFLINE" || device.healthStatus === "STALE" || !device.isPaired).map((device) => ({
        id: `DEVICE_${device.id}`,
        alertKey: `DEVICE:${device.id}:${device.lastSeenAt?.getTime() ?? 0}:${device.healthStatus}:${device.isPaired ? "PAIRED" : "UNPAIRED"}`,
        type: "DEVICE_HEALTH",
        severity: device.healthStatus === "OFFLINE" ? "HIGH" : "MEDIUM",
        title: device.healthStatus === "OFFLINE" ? "Terminal is offline" : !device.isPaired ? "Terminal is not paired" : "Terminal heartbeat is stale",
        detail: !device.isPaired ? `${device.terminalId} has no paired operating device.` : device.lastSeenAt ? `${device.terminalId} last checked in at ${device.lastSeenAt.toISOString()}.` : `${device.terminalId} has never checked in.`,
        createdAt: (device.lastSeenAt ?? new Date()).toISOString(),
        entityId: device.id,
      })),
    ];
    try {
      const activeKeys = alerts.map((alert) => alert.alertKey);
      await prisma.$executeRawUnsafe(
        `UPDATE operational_alert_acknowledgments
         SET resolved_at = NOW()
         WHERE store_id = $1 AND resolved_at IS NULL AND NOT (alert_key = ANY($2::text[]))`,
        session.storeId,
        activeKeys,
      );
      const acknowledgments = await prisma.$queryRawUnsafe(
        `SELECT alert_key AS "alertKey" FROM operational_alert_acknowledgments
         WHERE store_id = $1 AND resolved_at IS NULL`,
        session.storeId,
      ) as Array<{ alertKey: string }>;
      clearedAlertKeys = acknowledgments.map((item) => item.alertKey);
    } catch {
      // The additive acknowledgment migration may not yet be applied.
    }
    return NextResponse.json({ alerts: alerts.filter((alert) => !clearedAlertKeys.includes(alert.alertKey)) });
  } catch (error) {
    console.error("[GET /api/alerts/operational]", error);
    return NextResponse.json({ error: "Unable to load operational alerts." }, { status: 500 });
  }
}
