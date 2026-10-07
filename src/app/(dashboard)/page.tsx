import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import { PosHomeDashboard } from "@/components/home/pos-home-dashboard";

export default async function HomePage() {
  const session = await getSession();
  if (session?.role === "OWNER") redirect("/owner");

  return (
    <PosHomeDashboard
      employeeName={session?.name ?? "Cashier"}
      storeName={session?.storeName ?? "LottoOps Store"}
    />
  );
}
