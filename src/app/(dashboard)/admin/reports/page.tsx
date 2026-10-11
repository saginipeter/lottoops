import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import { canAccessReports } from "@/lib/permissions";
import { ReportsWorkspace } from "@/components/reports/reports-workspace";

export default async function AdminReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/admin/reports");
  if (!canAccessReports(session)) redirect("/pos");

  return (
    <div className="flex min-h-full flex-col bg-[#f4f7fb]">
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7">
        <div className="mx-auto max-w-[1366px]"><ReportsWorkspace role={session.role} /></div>
      </main>
    </div>
  );
}
