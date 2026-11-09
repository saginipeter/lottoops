import { getSession } from "@/lib/get-session";
import { LotteryPos } from "@/components/pos/lottery-pos";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function PosPage({ searchParams }: { searchParams?: Promise<{ shiftId?: string; terminal?: string }> }) {
  const session = await getSession();
  if (!session?.storeId) redirect("/login?from=/pos");
  const params = searchParams ? await searchParams : {};
  const shiftBoundRole = session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD";
  let shiftId = shiftBoundRole ? session.shiftId ?? null : params.shiftId ?? null;
  let terminalId = shiftBoundRole ? session.terminalId ?? null : params.terminal?.trim().toUpperCase() ?? null;
  let shiftNumber: number | null = shiftBoundRole ? session.shiftNumber ?? null : null;

  if (prisma) {
    const openShifts: Array<{ id: string; shiftNumber: number | null; terminalId: string | null }> = await prisma.shift.findMany({
      where: {
        storeId: session.storeId,
        status: "OPEN",
        ...(shiftBoundRole ? { id: shiftId ?? "__staff_has_no_selected_shift__" } : {}),
        ...(terminalId ? { terminalId } : {}),
      },
      select: { id: true, shiftNumber: true, terminalId: true },
      orderBy: [{ terminalId: "asc" }, { shiftNumber: "asc" }],
    });
    if (!shiftId && openShifts.length === 1) shiftId = openShifts[0].id;
    const selected = openShifts.find((shift) => shift.id === shiftId);
    if (!selected || !selected.terminalId || (terminalId && selected.terminalId !== terminalId)) {
      redirect(`/shifts${terminalId ? `?terminal=${encodeURIComponent(terminalId)}` : ""}`);
    }
    terminalId = selected.terminalId;
    shiftNumber = selected.shiftNumber;
  }

  if (!shiftId || !terminalId) redirect("/shifts");
  return <LotteryPos
    storeId={session.storeId}
    operatorId={session.userId}
    loginSessionId={session.loginSessionId ?? "legacy-session"}
    employeeName={session.name}
    storeName={session.storeName ?? "LottoOps Store"}
    terminalId={terminalId}
    shiftId={shiftId}
    shiftNumber={shiftNumber}
  />;
}
