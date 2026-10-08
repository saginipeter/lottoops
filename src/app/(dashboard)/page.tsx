import { getSession } from "@/lib/get-session";
import { PosHomeDashboard } from "@/components/home/pos-home-dashboard";

export default async function HomePage() {
  const session = await getSession();

  return (
    <PosHomeDashboard
      employeeName={session?.name ?? "Cashier"}
      storeName={session?.storeName ?? "LottoOps Store"}
      role={session?.role ?? "EMPLOYEE"}
      grantedPermissions={session?.grantedPermissions ?? []}
    />
  );
}
