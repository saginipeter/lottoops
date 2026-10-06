import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { getSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { LotteryPos } from "@/components/pos/lottery-pos";

export default async function PosPage() {
  const session = await getSession();
  if (!session) return null;

  const openShift = prisma
    ? await prisma.shift.findFirst({
        where: { storeId: session.storeId, status: "OPEN" },
        include: { inventoryAudit: { include: { lines: { select: { beginningPhysicalTicket: true } } } } },
        orderBy: { openedAt: "desc" },
      })
    : null;

  const beginningAuditComplete = Boolean(
    openShift?.inventoryAudit &&
      openShift.inventoryAudit.lines.every((line: { beginningPhysicalTicket: number | null }) => line.beginningPhysicalTicket !== null)
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header title="Lottery POS" subtitle="Phase 1 · Ticket sales terminal" />
      <PageToolbar
        left={<span className="text-xs text-text-secondary">{session.storeName ?? "LottoOps Store"}</span>}
        center={<span className="hidden sm:inline">Hardware scanner · Opening Audit protected</span>}
        right={<span className={openShift && beginningAuditComplete ? "font-semibold text-success-soft-text" : "font-semibold text-warning-soft-text"}>{openShift && beginningAuditComplete ? "POS ready" : "Sales locked"}</span>}
      />
      <LotteryPos shiftOpen={Boolean(openShift)} beginningAuditComplete={beginningAuditComplete} terminalId="T1" />
    </div>
  );
}
