import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";
import { OwnerDashboard } from "@/components/owner/owner-dashboard";

export default async function OwnerStoresPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "OWNER") redirect("/");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header title="Stores" subtitle="Manage your Lottoops store portfolio" />
      <PageToolbar
        left={<span className="text-xs text-text-secondary">All owned stores</span>}
        center={<span>Store portfolio</span>}
        right={<span className="text-xs font-semibold text-text-tertiary">OWNER</span>}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <OwnerDashboard view="stores" />
      </div>
      <StatusBar left={<span>Store portfolio</span>} center={<span>Owner access</span>} right={<span>Manage locations</span>} />
    </div>
  );
}