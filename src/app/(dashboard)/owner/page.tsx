import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";
import { OwnerDashboard } from "@/components/owner/owner-dashboard";

export default async function OwnerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "OWNER") redirect("/");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title="Owner Dashboard"
        subtitle="All stores at a glance — sales, shifts, and inventory"
      />

      <PageToolbar
        left={<span className="text-xs text-text-secondary">Enterprise scope</span>}
        center={<span>Regional and store comparison view</span>}
        right={<span className="text-xs text-text-tertiary">Role: OWNER</span>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <OwnerDashboard />
      </div>

      <StatusBar
        left={<span>Executive overview</span>}
        center={<span>Use filters to compare performance</span>}
        right={<span>Drill into exceptions</span>}
      />
    </div>
  );
}
