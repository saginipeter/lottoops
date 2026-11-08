import { getSession } from "@/lib/get-session";
import { LotteryPos } from "@/components/pos/lottery-pos";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function PosPage({ searchParams }: { searchParams?: Promise<{ shiftId?: string }> }) {
  const session = await getSession();
  if (!session?.storeId) redirect("/login?from=/pos");
  const params = searchParams ? await searchParams : {};
  const shiftBoundRole = session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD";
  let shiftId = shiftBoundRole ? session.shiftId ?? null : params.shiftId ?? null;
  let shiftNumber: number | null = shiftBoundRole ? session.shiftNumber ?? null : null;
  if (prisma) {
    const openShifts: Array<{ id: string; shiftNumber: number | null }> = await prisma.shift.findMany({
      where: { storeId: session.storeId, status: "OPEN" },
      select: { id: true, shiftNumber: true },
      orderBy: { shiftNumber: "asc" },
    });
    if (!shiftId && openShifts.length === 1) shiftId = openShifts[0].id;
    const selected = openShifts.find((shift) => shift.id === shiftId);
    if (!selected) redirect(`/shifts?from=${encodeURIComponent("/pos")}`);
    shiftNumber = selected.shiftNumber;
  }
  return <LotteryPos storeId={session.storeId} operatorId={session.userId} employeeName={session.name} storeName={session.storeName ?? "LottoOps Store"} terminalId="POS-01" shiftId={shiftId ?? ""} shiftNumber={shiftNumber} />;
}
