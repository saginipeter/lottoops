import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import ReceiveWizard from "@/components/receive/receive-wizard";

export default async function ReceiveInventoryPage() {
  const session = await getSession();
  if (!session?.storeId) redirect("/login?from=/inventory/receive");
  return <ReceiveWizard storeId={session.storeId} initialStep={1} receiverName={session.name} />;
}
