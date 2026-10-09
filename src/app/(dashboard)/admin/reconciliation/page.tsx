import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";
import { ReconciliationPanel } from "@/components/pos/reconciliation-panel";

export default async function ReconciliationPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/admin/reconciliation");
  if (session.role !== "OWNER" && session.role !== "MANAGER") redirect("/admin");
  return <main className="min-h-full px-5 py-6 sm:px-8 sm:py-8"><div className="mx-auto max-w-[1180px]"><ReconciliationPanel /></div></main>;
}
