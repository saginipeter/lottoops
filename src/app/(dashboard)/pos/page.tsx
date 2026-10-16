import { getSession } from "@/lib/get-session";
import { LotteryPos } from "@/components/pos/lottery-pos";
import { redirect } from "next/navigation";

export default async function PosPage() {
  const session = await getSession();
  if (!session?.storeId) redirect("/login?from=/pos");
  return <LotteryPos storeId={session.storeId} employeeName={session.name} storeName={session.storeName ?? "LottoOps Store"} terminalId="POS-01" />;
}
