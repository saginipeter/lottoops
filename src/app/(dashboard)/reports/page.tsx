import { Header } from "@/components/layout/header";
import { Panel } from "@/components/ui/panel";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { formatCurrency, formatDateTime, formatRelativeTime } from "@/lib/utils";

type StatusCount = Record<string, number>;

export default async function ReportsPage() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Reports" subtitle="Not authenticated" />
        <div className="flex-1 overflow-y-auto px-5 py-5">
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
        <Header title="Reports" subtitle="Database unavailable" />
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="rounded-lg border-2 border-dashed border-yellow-300 bg-yellow-50 p-6 text-center">
            <p className="text-yellow-800 font-medium">Database not connected</p>
          </div>
        </div>
      </div>
    );
  }

  const [openShift, recentClosedShifts, packs, recentLogs] = await Promise.all([
    prisma.shift.findFirst({
      where: {
        storeId: session.storeId,
        status: "OPEN",
      },
      include: {
        openedBy: {
          select: {
            name: true,
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
        openedBy: {
          select: { name: true },
        },
        closedBy: {
          select: { name: true },
        },
        lines: {
          include: {
            pack: {
              include: {
                game: true,
              },
            },
          },
        },
      },
      orderBy: {
        closedAt: "desc",
      },
      take: 10,
    }),
    prisma.pack.findMany({
      where: {
        storeId: session.storeId,
      },
      select: {
        id: true,
        status: true,
      },
    }),
    prisma.scanLogEntry.findMany({
      where: {
        storeId: session.storeId,
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
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const closedToday = recentClosedShifts.filter(
    (shift: {
      closedAt: Date | null;
    }) => shift.closedAt && shift.closedAt >= today
  );

  const salesToday = closedToday.reduce((sum: number, shift: any) => {
    const shiftSales = shift.lines.reduce((lineSum: number, line: any) => {
      return lineSum + Number(line.salesAmount ?? 0);
    }, 0);
    return sum + shiftSales;
  }, 0);

  const ticketsToday = closedToday.reduce((sum: number, shift: any) => {
    const shiftTickets = shift.lines.reduce((lineSum: number, line: any) => {
      return lineSum + Number(line.ticketsSold ?? 0);
    }, 0);
    return sum + shiftTickets;
  }, 0);

  const statusCounts = packs.reduce((acc: StatusCount, pack: any) => {
    acc[pack.status] = (acc[pack.status] ?? 0) + 1;
    return acc;
  }, {} as StatusCount);

  const gameSalesMap = new Map<string, { gameName: string; tickets: number; sales: number }>();
  for (const shift of recentClosedShifts as any[]) {
    for (const line of shift.lines as any[]) {
      const key = line.pack.game.id;
      const current = gameSalesMap.get(key) ?? {
        gameName: line.pack.game.name,
        tickets: 0,
        sales: 0,
      };
      current.tickets += Number(line.ticketsSold ?? 0);
      current.sales += Number(line.salesAmount ?? 0);
      gameSalesMap.set(key, current);
    }
  }

  const topGames = Array.from(gameSalesMap.values())
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Reports"
        subtitle="Daily summaries, shift performance, and scan audit history"
      />

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Panel className="p-4">
              <p className="text-xs uppercase tracking-wide text-text-tertiary">Shift Status</p>
              <p className="mt-2 text-xl font-semibold text-text">
                {openShift ? "OPEN" : "CLOSED"}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {openShift
                  ? `Opened ${formatRelativeTime(openShift.openedAt)} by ${openShift.openedBy.name}`
                  : "No active shift"}
              </p>
            </Panel>
            <Panel className="p-4">
              <p className="text-xs uppercase tracking-wide text-text-tertiary">Sales Today</p>
              <p className="mt-2 text-xl font-semibold text-text">{formatCurrency(salesToday)}</p>
              <p className="mt-1 text-xs text-text-secondary">{ticketsToday} tickets sold today</p>
            </Panel>
            <Panel className="p-4">
              <p className="text-xs uppercase tracking-wide text-text-tertiary">Back Stock</p>
              <p className="mt-2 text-xl font-semibold text-text">{statusCounts.BACK_STOCK ?? 0}</p>
              <p className="mt-1 text-xs text-text-secondary">Packs waiting for activation</p>
            </Panel>
            <Panel className="p-4">
              <p className="text-xs uppercase tracking-wide text-text-tertiary">Active Display</p>
              <p className="mt-2 text-xl font-semibold text-text">{statusCounts.ACTIVE ?? 0}</p>
              <p className="mt-1 text-xs text-text-secondary">Packs currently on sale</p>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Panel className="xl:col-span-2 p-4">
              <h3 className="text-base font-semibold text-text">Recent Closed Shifts</h3>
              {recentClosedShifts.length === 0 ? (
                <p className="mt-3 text-sm text-text-secondary">No closed shifts found yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
                        <th className="py-2 pr-4">Closed At</th>
                        <th className="py-2 pr-4">Opened By</th>
                        <th className="py-2 pr-4">Closed By</th>
                        <th className="py-2 pr-4 text-right">Tickets</th>
                        <th className="py-2 text-right">Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentClosedShifts.map((shift: any) => {
                        const shiftTickets = shift.lines.reduce(
                          (sum: number, line: any) => sum + Number(line.ticketsSold ?? 0),
                          0
                        );
                        const shiftSales = shift.lines.reduce(
                          (sum: number, line: any) => sum + Number(line.salesAmount ?? 0),
                          0
                        );

                        return (
                          <tr key={shift.id} className="border-b border-border">
                            <td className="py-2 pr-4 text-text-secondary">
                              {shift.closedAt ? formatDateTime(shift.closedAt) : "-"}
                            </td>
                            <td className="py-2 pr-4 text-text">{shift.openedBy.name}</td>
                            <td className="py-2 pr-4 text-text">
                              {shift.closedBy?.name ?? "Unknown"}
                            </td>
                            <td className="py-2 pr-4 text-right font-medium text-text">
                              {shiftTickets}
                            </td>
                            <td className="py-2 text-right font-medium text-text">
                              {formatCurrency(shiftSales)}
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
              <h3 className="text-base font-semibold text-text">Top Games (Recent)</h3>
              {topGames.length === 0 ? (
                <p className="mt-3 text-sm text-text-secondary">No game sales data available.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {topGames.map((game) => (
                    <div
                      key={game.gameName}
                      className="rounded-md border border-border bg-surface-soft p-3"
                    >
                      <p className="text-sm font-semibold text-text">{game.gameName}</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {game.tickets} tickets · {formatCurrency(game.sales)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel className="p-4">
            <h3 className="text-base font-semibold text-text">Scan Audit Log</h3>
            {recentLogs.length === 0 ? (
              <p className="mt-3 text-sm text-text-secondary">No scan activity logged yet.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {recentLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="flex flex-col gap-1 rounded-md border border-border bg-surface-soft p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                        {log.action.replaceAll("_", " ")}
                      </p>
                      <p className="text-sm text-text">{log.detail}</p>
                      <p className="text-xs text-text-secondary">By {log.performedBy.name}</p>
                    </div>
                    <p className="text-xs text-text-tertiary">{formatDateTime(log.timestamp)}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
