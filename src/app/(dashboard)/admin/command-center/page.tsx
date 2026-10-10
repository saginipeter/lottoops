import { getSession } from "@/lib/get-session";
import { getPlanAccess } from "@/lib/plan-access";
import { redirect } from "next/navigation";
import { CommandCenter } from "@/components/owner/command-center";

export default async function CommandCenterPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/admin/command-center");
  if (session.role !== "OWNER") redirect("/admin");
  const access = await getPlanAccess(session, "MULTI_STORE");

  return <main className="min-h-full bg-[#f4f7fb] px-5 py-6 sm:px-8 sm:py-8"><div className="mx-auto max-w-[1366px]"><CommandCenter enabled={access.allowed} planKey={access.planKey} /></div></main>;
}
