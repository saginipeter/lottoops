import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { LiveScanDashboard } from "@/components/inventory/live-scan-dashboard";
import { getSession } from "@/lib/get-session";

interface LiveScanPageProps {
  searchParams?: Promise<{
    terminal?: string;
  }>;
}

export default async function LiveScanPage({ searchParams }: LiveScanPageProps) {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="Live Scan"
          subtitle="Real-time ticket scanning and sales tracking"
        />
        <div className="flex-1 overflow-y-auto px-4 py-3.5">
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

  // Fetch current shift for the store
  const currentShift = openShiftRows[0]
    ? await prisma.shift.findUnique({
        where: { id: openShiftRows[0].id },
        include: {
          openedBy: true,
          lines: {
            include: {
              pack: {
                include: {
                  game: true,
                  slot: true,
                },
              },
            },
            orderBy: {
              id: "desc",
            },
          },
        },
      })
    : null;

  // Fetch active packs for the store
  const activePacks = await prisma.pack.findMany({
    where: {
      storeId: session.storeId,
      status: "ACTIVE",
      slot: {
        isNot: null,
      },
    },
    include: {
      game: true,
      slot: true,
    },
    orderBy: {
      activatedAt: "desc",
    },
  });

  const shiftData = currentShift ? JSON.parse(
    JSON.stringify(currentShift, (_, value) =>
      typeof value === "bigint"
        ? value.toString()
        : value
    )
  ) : null;

  const packsData = JSON.parse(
    JSON.stringify(activePacks, (_, value) =>
      typeof value === "bigint"
        ? value.toString()
        : value
    )
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Live Scan"
        subtitle={`Real-time ticket scanning and sales tracking · Terminal ${terminalId}`}
      />

      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        <LiveScanDashboard
          currentShift={shiftData}
          activePacks={packsData}
          terminalId={terminalId}
        />
      </div>
    </div>
  );
}
