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
      <header className="shrink-0 border-b border-[#0d1528] bg-[#17233f] text-white shadow-[0_5px_0_rgba(13,21,40,0.18)]">
        <div className="mx-auto flex min-h-[72px] max-w-[1366px] items-center gap-4 px-4 py-3 sm:px-7">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8be2ff]">LottoOps management console</p>
            <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">Reports</h1>
            <p className="truncate text-xs text-white/60">Focused operational, financial, and inventory reporting</p>
          </div>
          <div className="hidden text-right sm:block"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Scope</p><p className="text-sm font-bold">{session.storeName ?? "Current store"}</p></div>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7">
        <div className="mx-auto max-w-[1366px]"><ReportsWorkspace role={session.role} /></div>
      </main>
    </div>
  );
}
