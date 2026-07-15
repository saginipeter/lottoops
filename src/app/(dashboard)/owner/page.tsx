import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";
import { OwnerDashboard } from "@/components/owner/owner-dashboard";

export default async function OwnerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "OWNER") redirect("/");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Owner Dashboard"
        subtitle="All stores at a glance — sales, shifts, and inventory"
      />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <OwnerDashboard />
      </div>
    </div>
  );
}
