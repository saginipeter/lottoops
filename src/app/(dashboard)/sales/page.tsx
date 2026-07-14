import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Panel } from "@/components/ui/panel";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function SalesPage() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Sales" subtitle="Not authenticated" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-lg border-2 border-dashed border-red-300 bg-red-50 p-6 text-center">
            <p className="text-red-600 font-medium">Not authenticated</p>
          </div>
        </div>
      </div>
    );
  }

  if (!prisma) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Sales" subtitle="Database unavailable" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-lg border-2 border-dashed border-yellow-300 bg-yellow-50 p-6 text-center">
            <p className="text-yellow-800 font-medium">Database not connected</p>
          </div>
        </div>
      </div>
    );
  }

  const [openShift, recentClosedShifts, activePacks] = await Promise.all([
    prisma.shift.findFirst({
      where: {
        storeId: session.storeId,
        status: "OPEN",
      },
      include: {
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
    }),
    prisma.shift.findMany({
      where: {
        storeId: session.storeId,
        status: "CLOSED",
      },
      include: {
        lines: true,
      },
      orderBy: {
        closedAt: "desc",
      },
      take: 7,
    }),
    prisma.pack.count({
      where: {
        storeId: session.storeId,
        status: "ACTIVE",
      },
    }),
  ]);

  const currentLines = openShift?.lines ?? [];

  const currentTickets = currentLines.reduce((sum: number, line: any) => {
    const fallbackSold = Math.max(
      Number(line.beginningTicket) - Number(line.endingTicket ?? line.beginningTicket),
      0
    );
    return sum + Number(line.ticketsSold ?? fallbackSold);
  }, 0);

  const currentSales = currentLines.reduce((sum: number, line: any) => {
    const fallbackSold = Math.max(
      Number(line.beginningTicket) - Number(line.endingTicket ?? line.beginningTicket),
      0
    );
    const fallbackSales = fallbackSold * Number(line.pack.game.price);
    return sum + Number(line.salesAmount ?? fallbackSales);
  }, 0);

  const weekSales = recentClosedShifts.reduce((sum: number, shift: any) => {
    const shiftSales = shift.lines.reduce((lineSum: number, line: any) => {
      return lineSum + Number(line.salesAmount ?? 0);
    }, 0);
    return sum + shiftSales;
  }, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Sales"
        subtitle="Operational sales center for current shift and reconciliation"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Shift Status"
              value={openShift ? "OPEN" : "CLOSED"}
              hint={openShift ? "Sales are in progress" : "Open shift to start sales"}
            />
            <StatCard
              label="Current Shift Sales"
              value={formatCurrency(currentSales)}
              hint={`${currentTickets} tickets sold`}
            />
            <StatCard
              label="Active Packs"
              value={String(activePacks)}
              hint="Packs available on display"
            />
            <StatCard
              label="Last 7 Shift Sales"
              value={formatCurrency(weekSales)}
              hint={`${recentClosedShifts.length} closed shifts`}
            />
          </div>

          <Panel className="p-4">
            <div className="flex flex-wrap gap-2">
              <QuickLink href="/inventory/live-scan" label="Go to Live Scan" />
              <QuickLink href="/shifts" label="Open/Close Shift" />
              <QuickLink href="/reports" label="Open Reports" />
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Panel className="xl:col-span-2 p-4">
              <h3 className="text-base font-semibold text-text">Current Shift Sales by Pack</h3>
              {!openShift ? (
                <p className="mt-3 text-sm text-text-secondary">
                  No open shift. Open a shift to track live sales.
                </p>
              ) : currentLines.length === 0 ? (
                <p className="mt-3 text-sm text-text-secondary">
                  No shift lines found for this shift.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
                        <th className="py-2 pr-4">Slot</th>
                        <th className="py-2 pr-4">Game</th>
                        <th className="py-2 pr-4">Pack</th>
                        <th className="py-2 pr-4 text-right">Tickets</th>
                        <th className="py-2 text-right">Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentLines.map((line: any) => {
                        const sold = Number(
                          line.ticketsSold ??
                            Math.max(
                              Number(line.beginningTicket) -
                                Number(line.endingTicket ?? line.beginningTicket),
                              0
                            )
                        );
                        const sales = Number(
                          line.salesAmount ?? sold * Number(line.pack.game.price)
                        );
                        return (
                          <tr key={line.id} className="border-b border-border">
                            <td className="py-2 pr-4 text-text">{line.slotNumber}</td>
                            <td className="py-2 pr-4 text-text">{line.pack.game.name}</td>
                            <td className="py-2 pr-4 text-text-secondary">
                              #{line.pack.packNumber ?? "N/A"}
                            </td>
                            <td className="py-2 pr-4 text-right font-medium text-text">
                              {sold}
                            </td>
                            <td className="py-2 text-right font-medium text-text">
                              {formatCurrency(sales)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel className="p-4">
              <h3 className="text-base font-semibold text-text">Recent Closed Shifts</h3>
              {recentClosedShifts.length === 0 ? (
                <p className="mt-3 text-sm text-text-secondary">
                  No closed shifts yet.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {recentClosedShifts.map((shift: any) => {
                    const shiftSales = shift.lines.reduce((sum: number, line: any) => {
                      return sum + Number(line.salesAmount ?? 0);
                    }, 0);
                    const shiftTickets = shift.lines.reduce((sum: number, line: any) => {
                      return sum + Number(line.ticketsSold ?? 0);
                    }, 0);
                    return (
                      <div
                        key={shift.id}
                        className="rounded-md border border-border bg-surface-soft p-3"
                      >
                        <p className="text-xs text-text-tertiary">
                          {shift.closedAt ? formatDateTime(shift.closedAt) : "Not closed"}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-text">
                          {formatCurrency(shiftSales)}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {shiftTickets} tickets
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Panel className="p-4">
      <p className="text-xs uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-2 text-xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{hint}</p>
    </Panel>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-colors hover:bg-surface-soft"
    >
      {label}
    </Link>
  );
}