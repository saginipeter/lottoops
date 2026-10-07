import { getSession } from "@/lib/get-session";
import { InventoryPos } from "@/components/inventory/inventory-pos";

export default async function InventoryPage() {
  const session = await getSession();
  return <InventoryPos employeeName={session?.name ?? "Cashier"} storeName={session?.storeName ?? "LottoOps Store"} />;
}
