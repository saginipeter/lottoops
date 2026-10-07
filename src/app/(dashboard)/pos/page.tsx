import { getSession } from "@/lib/get-session";
import { LotteryPos } from "@/components/pos/lottery-pos";

export default async function PosPage() {
  const session = await getSession();
  return <LotteryPos employeeName={session?.name ?? "Cashier"} storeName={session?.storeName ?? "LottoOps Store"} terminalId="POS-01" />;
}
