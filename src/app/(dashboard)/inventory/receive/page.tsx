import { getSession } from "@/lib/get-session";
import { ReceiveStockPos } from "@/components/receive/receive-stock-pos";

export default async function ReceiveInventoryPage() {
  const session = await getSession();
  return <ReceiveStockPos employeeName={session?.name ?? "Cashier"} storeName={session?.storeName ?? "LottoOps Store"} />;
}
