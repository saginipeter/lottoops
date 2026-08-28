import Link from "next/link";
import { Header } from "@/components/layout/header";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { Button } from "@/components/ui/button";
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
    ADD COLUMN IF NOT EXISTS "terminalId" TEXT
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openShiftRows = (await prisma.$queryRawUnsafe(
    `
    SELECT id
    FROM shifts
    WHERE "storeId" = $1
      AND status = 'OPEN'
      AND COALESCE("terminalId", 'T1') = $2
    ORDER BY "openedAt" DESC
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

  let inventoryAudit = null;
  if (openShift) {
    try {
      inventoryAudit = await prisma.inventoryAudit.findUnique({
        where: { shiftId: openShift.id },
        include: { lines: true, begunBy: { select: { name: true } }, endedBy: { select: { name: true } } },
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

  const activePackCount = openShift?.lines?.length ?? 0;
  const eventCount = timelineEvents.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title="Shift Management"
        subtitle={
          openShift
            ? `${session.role === "EMPLOYEE" ? `${session.name} · ${session.storeName} · ` : ""}Terminal ${terminalId}: shift is open — reconcile and close when ready`
            : `${session.role === "EMPLOYEE" ? `${session.name} · ${session.storeName} · ` : ""}Terminal ${terminalId}: open and close daily shifts`
        }
      />

      <PageToolbar
        left={
          <div className="flex items-center gap-1">
            {(["T1", "T2", "T3", "T4"] as const).map((terminal) => (
              <Link key={terminal} href={`/shifts?terminal=${terminal}`}>
                <Button size="xs" variant={terminalId === terminal ? "secondary" : "ghost"}>
                  {terminal}
                </Button>
              </Link>
            ))}
          </div>
        }
        center={<span>Ctrl+S Save | Alt+C Close Shift</span>}
        right={<span className="text-xs text-text-tertiary">{openShift ? "Shift Open" : "No Active Shift"}</span>}
      />

      {session.role === "EMPLOYEE" && (
        <div className="border-b border-border bg-surface px-4 py-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <Link
              href="/"
              className="flex min-h-[68px] items-center justify-between rounded-lg border border-border bg-surface-soft px-4 py-3"
            >
              <span className="text-base font-semibold text-text">Back</span>
              <span className="text-xs text-text-tertiary">Dashboard</span>
            </Link>
            <Link
              href="/shifts"
              className="flex min-h-[68px] items-center justify-between rounded-lg border border-border bg-surface-soft px-4 py-3"
            >
              <span className="text-base font-semibold text-text">Shift Screen</span>
              <span className="text-xs text-text-tertiary">Open/Close</span>
            </Link>
            <Link
              href={`/inventory/live-scan?terminal=${terminalId}`}
              className="flex min-h-[68px] items-center justify-between rounded-lg border border-border bg-surface-soft px-4 py-3"
            >
              <span className="text-base font-semibold text-text">Live Scan</span>
              <span className="text-xs text-text-tertiary">Sales Entry</span>
            </Link>
            <LogoutButton
              label="Logout"
              className="min-h-[68px] justify-between rounded-lg border border-red-300 bg-red-600 px-4 py-3 text-base font-semibold text-white hover:bg-red-700"
            />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <ShiftDashboard
          shift={shiftData}
          shiftEvents={eventData}
          terminalId={terminalId}
        />
      </div>

      <StatusBar
        left={<span>Terminal: {terminalId}</span>}
        center={<span>Active Packs: {activePackCount} | Timeline Events: {eventCount}</span>}
        right={<span>{openShift ? "In Progress" : "Ready to Open"}</span>}
      />
    </div>
  );
}