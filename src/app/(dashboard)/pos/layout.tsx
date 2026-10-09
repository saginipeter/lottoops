import { getSession } from "@/lib/get-session";
import { canEnterShell } from "@/lib/shell-routing";
import { redirect } from "next/navigation";

export default async function PosShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?from=/pos");
  if (!canEnterShell(session, "pos")) redirect("/admin");

  return <div data-app-shell="pos" className="min-h-full">{children}</div>;
}
