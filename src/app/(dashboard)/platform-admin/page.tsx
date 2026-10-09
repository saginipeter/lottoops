import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { PlatformControlCenter } from "@/components/platform/platform-control-center";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";

export default async function PlatformAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/platform-admin");
  if (session.role !== "PLATFORM_ADMIN") redirect("/admin");

  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><Header title="LottoOps Platform" subtitle="Manage customer organizations, subscriptions, access, and system health" /><PageToolbar left={<span className="text-xs text-text-secondary">Marionova Partners Limited</span>} center={<span>Platform operations</span>} right={<span className="text-xs font-semibold text-text-tertiary">PLATFORM ADMIN</span>} /><div className="min-h-0 flex-1 overflow-y-auto px-5 py-5"><PlatformControlCenter /></div><StatusBar left={<span>Platform administration</span>} center={<span>Customer accounts and subscriptions</span>} right={<span>Operator access</span>} /></div>;
}
