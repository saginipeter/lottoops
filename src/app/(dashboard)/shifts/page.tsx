import { Header } from "@/components/layout/header";
import ShiftDashboard from "@/components/shifts/shift-dashboard";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";

export default async function ShiftsPage() {
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

  const openShift = await prisma.shift.findFirst({
    where: {
      status: "OPEN",
      storeId: session.storeId,
    },
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
    orderBy: {
      openedAt: "desc",
    },
  });

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
        subtitle={openShift ? "Shift is open — reconcile and close when ready" : "Open and close daily shifts"}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <ShiftDashboard
          shift={shiftData}
          shiftEvents={eventData}
        />
      </div>
    </div>
  );
}