import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { PlatformControlCenter } from "@/components/platform/platform-control-center";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";

export default async function PlatformPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "PLATFORM_ADMIN") redirect("/");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header title="LottoOps Control Center" subtitle="Platform administration for customer accounts and system performance" />
      <PageToolbar
        left={<span className="text-xs text-text-secondary">Software operator view</span>}
        center={<span>All customer stores</span>}
        right={<span className="text-xs font-semibold text-text-tertiary">PLATFORM ADMIN</span>}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <PlatformControlCenter />
      </div>
      <StatusBar left={<span>Platform control center</span>} center={<span>Customer operations overview</span>} right={<span>Operator access</span>} />
    </div>
  );
}