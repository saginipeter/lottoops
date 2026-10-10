import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";
import { OwnerDashboard } from "@/components/owner/owner-dashboard";
import { OwnerShellHeader } from "@/components/owner/owner-shell-header";

export default async function OwnerStoresPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "OWNER") redirect("/");

  return (
    <div className="flex min-h-full flex-col bg-[#f4f7fb]">
      <OwnerShellHeader title="Stores" subtitle="Manage your LottoOps store portfolio" context="Store portfolio" />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7">
        <OwnerDashboard view="stores" />
      </div>
    </div>
  );
}
