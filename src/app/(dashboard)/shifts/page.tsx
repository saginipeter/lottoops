import { Header } from "@/components/layout/header";
import { ShiftPos } from "@/components/shifts/shift-pos";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { getShiftParticipants } from "@/lib/shift-participants";
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
  const terminalId =
    typeof resolvedSearchParams.terminal === "string" && resolvedSearchParams.terminal.trim()
      ? resolvedSearchParams.terminal.trim().toUpperCase()
      : "T1";

  const openShiftRows: Array<{ id: string; shiftNumber: number | null; openedAt: Date }> = await prisma.shift.findMany({
    where: {
      storeId: session.storeId,
      status: "OPEN",
      ...(session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD"
        ? { id: session.shiftId ?? "__employee_has_no_selected_shift__" }
        : {}),
    },
    select: { id: true, shiftNumber: true, openedAt: true },
    orderBy: [{ shiftNumber: "asc" }, { openedAt: "asc" }],
  });
  const requestedShiftId = session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD"
    ? session.shiftId
    : typeof resolvedSearchParams.shiftId === "string" ? resolvedSearchParams.shiftId : undefined;
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
        where: { storeId: session.storeId, status: "CLOSED", closedAt: { not: null } },
        orderBy: { closedAt: "desc" },
        select: {
          openedAt: true,
          closedAt: true,
          openedBy: { select: { name: true } },
          closedBy: { select: { name: true } },
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

  const activePackCount = openShift
    ? await prisma.pack.count({
        where: { storeId: session.storeId, status: "ACTIVE", slot: { isNot: null } },
      })
    : 0;
  const cashRows = openShift
    ? await prisma.$queryRawUnsafe(
        `SELECT COALESCE("openingCash", 0)::numeric AS "openingCash", "expectedCash", "countedCash", "cashVariance" FROM shifts WHERE id = $1 LIMIT 1`,
        openShift.id
      ) as Array<{ openingCash: string | number; expectedCash: string | number | null; countedCash: string | number | null; cashVariance: string | number | null }>
    : [];
  const cashState = cashRows[0] ?? { openingCash: 0, expectedCash: null, countedCash: null, cashVariance: null };
  const hydratedShiftData = shiftData ? { ...shiftData, ...cashState } : null;

  return (
    <ShiftPos
      shift={hydratedShiftData}
      recentClosedShift={recentClosedShift ? JSON.parse(JSON.stringify(recentClosedShift)) : null}
      terminalId={terminalId}
      openShifts={openShiftRows.map((row) => ({ id: row.id, shiftNumber: row.shiftNumber, openedAt: row.openedAt.toISOString() }))}
      selectedShiftId={openShift?.id ?? null}
      canManageShifts={session.role === "OWNER" || session.role === "MANAGER"}
      isEmployee={session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD"}
      activeDisplayPackCount={activePackCount}
      shiftEvents={eventData}
      participants={JSON.parse(JSON.stringify(participants))}
      employeeName={session.name}
      storeName={session.storeName ?? "LottoOps Store"}
    />
  );
}
