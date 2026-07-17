import { Header } from "@/components/layout/header";
import ShiftDashboard from "@/components/shifts/shift-dashboard";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";

interface ShiftsPageProps {
  searchParams?: Promise<{
    terminal?: string;
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

  const resolvedSearchParams = (await searchParams) ?? {};
  const terminalId =
    typeof resolvedSearchParams.terminal === "string" && resolvedSearchParams.terminal.trim()
      ? resolvedSearchParams.terminal.trim().toUpperCase()
      : "T1";

  await prisma.$executeRawUnsafe(`
    ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS terminal_id TEXT
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openShiftRows = (await prisma.$queryRawUnsafe(
    `
    SELECT id
    FROM shifts
    WHERE store_id = $1
      AND status = 'OPEN'
      AND COALESCE(terminal_id, 'T1') = $2
    ORDER BY opened_at DESC
    LIMIT 1
    `,
    session.storeId,
    terminalId
  )) as { id: string }[];

  const openShift = openShiftRows[0]
    ? await prisma.shift.findUnique({
        where: { id: openShiftRows[0].id },
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

  const timelineEvents = openShift
    ? await prisma.scanLogEntry.findMany({
        where: {
          storeId: session.storeId,
          timestamp: {
            gte: openShift.openedAt,
          },
          action: {
            in: ["SHIFT_OPEN", "ACTIVATED", "RETURNED", "SOLD_OUT", "SHIFT_CLOSE"],
          },
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
        JSON.stringify(openShift, (_, value) => {
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Shift Management"
        subtitle={
          openShift
            ? `Terminal ${terminalId}: shift is open — reconcile and close when ready`
            : `Terminal ${terminalId}: open and close daily shifts`
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <ShiftDashboard
          shift={shiftData}
          shiftEvents={eventData}
          terminalId={terminalId}
        />
      </div>
    </div>
  );
}