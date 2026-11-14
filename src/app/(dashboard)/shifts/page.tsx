import { Header } from "@/components/layout/header";
import { ShiftPos } from "@/components/shifts/shift-pos";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { getShiftParticipants } from "@/lib/shift-participants";
import { ensureDeviceRegistrySchema } from "@/lib/device-registry";
import { LivePageRefresh } from "@/components/layout/live-page-refresh";
import { redirect } from "next/navigation";

interface ShiftsPageProps {
  searchParams?: Promise<{
    terminal?: string;
    shiftId?: string;
  }>;
}

export default async function ShiftsPage({ searchParams }: ShiftsPageProps) {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Shift Management" subtitle="Not authenticated" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-lg border-2 border-dashed border-red-300 bg-red-50 p-6 text-center">
            <p className="text-red-600 font-medium">Not authenticated</p>
          </div>
        </div>
      </div>
    );
  }
  if (session.role === "AUDITOR") redirect("/reports");

  const resolvedSearchParams = (await searchParams) ?? {};
  const staffBound = session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD";
  let terminalOptions = ["T1", "T2"];
  try {
    await ensureDeviceRegistrySchema();
    const [devices, registryRows] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT terminal_id AS "terminalId" FROM store_devices WHERE store_id = $1 AND active = TRUE ORDER BY terminal_id ASC`,
        session.storeId,
      ) as Promise<Array<{ terminalId: string }>>,
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS count FROM store_devices WHERE store_id = $1`,
        session.storeId,
      ) as Promise<Array<{ count: number }>>,
    ]);
    if (Number(registryRows[0]?.count ?? 0) > 0) terminalOptions = devices.map((device) => device.terminalId);
  } catch {
    // Older stores can still operate using the standard T1/T2 terminal labels.
  }
  const requestedTerminal = typeof resolvedSearchParams.terminal === "string" ? resolvedSearchParams.terminal.trim().toUpperCase() : "";
  let terminalId = staffBound && session.shiftId
    ? session.terminalId ?? ""
    : terminalOptions.includes(requestedTerminal) ? requestedTerminal : terminalOptions[0] ?? "T1";
  if (staffBound && session.shiftId && !terminalId) redirect("/login?from=/shifts");

  const allOpenShiftRows: Array<{ id: string; shiftNumber: number | null; terminalId: string | null; openedAt: Date }> = await prisma.shift.findMany({
    where: {
      storeId: session.storeId,
      status: "OPEN",
      ...(staffBound && session.shiftId
        ? { id: session.shiftId ?? "__employee_has_no_selected_shift__" }
        : {}),
    },
    select: { id: true, shiftNumber: true, terminalId: true, openedAt: true },
    orderBy: [{ terminalId: "asc" }, { shiftNumber: "asc" }, { openedAt: "asc" }],
  });
  if (!staffBound) terminalOptions = Array.from(new Set([...terminalOptions, ...allOpenShiftRows.flatMap((row) => row.terminalId ? [row.terminalId] : [])])).sort();
  const requestedShiftId = staffBound
    ? session.shiftId
    : typeof resolvedSearchParams.shiftId === "string" ? resolvedSearchParams.shiftId : undefined;
  if (!staffBound && requestedShiftId) {
    const requestedShift = allOpenShiftRows.find((row) => row.id === requestedShiftId);
    if (requestedShift?.terminalId) terminalId = requestedShift.terminalId;
  }
  const openShiftRows = allOpenShiftRows.filter((row) => row.terminalId === terminalId);
  const selectedShift = requestedShiftId
    ? openShiftRows.find((row) => row.id === requestedShiftId)
    : openShiftRows.length === 1 ? openShiftRows[0] : null;
  const openShift = selectedShift
    ? await prisma.shift.findUnique({
        where: { id: selectedShift.id },
        include: {
          openedBy: {
            select: {
              name: true,
            },
          },
          lines: {
            include: {
              pack: {
                include: {
                  game: true,
                },
              },
            },
            orderBy: {
              slotNumber: "asc",
            },
          },
        },
      })
    : null;

  const recentClosedShift = openShift
    ? null
    : await prisma.shift.findFirst({
        where: { storeId: session.storeId, terminalId, status: "CLOSED", closedAt: { not: null } },
        orderBy: { closedAt: "desc" },
        select: {
          id: true,
          openedAt: true,
          closedAt: true,
          openedBy: { select: { name: true } },
          closedBy: { select: { name: true } },
          shiftNumber: true,
          terminalId: true,
        },
      });

  let inventoryAudit = null;
  if (openShift) {
    try {
      inventoryAudit = await prisma.inventoryAudit.findUnique({
        where: { shiftId: openShift.id },
        include: {
          lines: {
            where: { pack: { status: "ACTIVE", slot: { isNot: null } } },
            include: { pack: { select: { serialNumber: true, game: { select: { name: true } } } } },
          },
          begunBy: { select: { name: true } },
          endedBy: { select: { name: true } },
        },
      });
    } catch (error) {
      console.warn("Inventory audit tables are unavailable; loading shift without audit state.", error);
    }
  }

  const timelineEvents = openShift
    ? await prisma.scanLogEntry.findMany({
        where: {
          storeId: session.storeId,
          timestamp: {
            gte: openShift.openedAt,
          },
          action: { in: ["SHIFT_OPEN", "SHIFT_CLOSE"] },
          detail: { contains: `Shift ${openShift.shiftNumber ?? "Unnumbered"}` },
          AND: [{ detail: { contains: `terminal ${terminalId}` } }],
        },
        include: {
          performedBy: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: 20,
      })
    : [];

  const eventData = timelineEvents.map((event: any) => ({
    id: event.id,
    action: event.action,
    detail: event.detail,
    timestamp: event.timestamp.toISOString(),
    performedBy: event.performedBy?.name ?? "Unknown",
  }));

  const shiftData = openShift
    ? JSON.parse(
        JSON.stringify({ ...openShift, inventoryAudit }, (_, value) => {
          if (typeof value === "bigint") return value.toString();
          if (
            value &&
            typeof value === "object" &&
            value.constructor &&
            value.constructor.name === "Decimal"
          ) {
            return Number(value);
          }
          return value;
        })
      )
    : null;
  const participants = openShift ? await getShiftParticipants(openShift.id) : [];

  const activeDisplayPacks: Array<{ id: string }> = openShift
    ? await prisma.pack.findMany({
        where: { storeId: session.storeId, status: "ACTIVE", slot: { isNot: null } },
        select: { id: true },
      })
    : [];
  const activePackIds = activeDisplayPacks.map((pack) => pack.id);
  const hydratedShiftData = shiftData;

  return (
    <>
    <LivePageRefresh intervalMs={3000} />
    <ShiftPos
      shift={hydratedShiftData}
      recentClosedShift={recentClosedShift ? JSON.parse(JSON.stringify(recentClosedShift)) : null}
      terminalId={terminalId}
      openShifts={openShiftRows.map((row) => ({ id: row.id, shiftNumber: row.shiftNumber, openedAt: row.openedAt.toISOString() }))}
      terminalOptions={terminalOptions}
      selectedShiftId={openShift?.id ?? null}
      canManageShifts={session.role === "OWNER" || session.role === "MANAGER"}
      canOpenShifts={session.role === "OWNER" || session.role === "MANAGER" || staffBound}
      isEmployee={session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD"}
      activeDisplayPackCount={activePackIds.length}
      activeDisplayPackIds={activePackIds}
      shiftEvents={eventData}
      participants={JSON.parse(JSON.stringify(participants))}
      employeeName={session.name}
      storeName={session.storeName ?? "LottoOps Store"}
    />
    </>
  );
}
