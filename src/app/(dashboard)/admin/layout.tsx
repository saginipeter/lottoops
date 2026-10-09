import { getSession } from "@/lib/get-session";
import { canEnterShell } from "@/lib/shell-routing";
import { redirect } from "next/navigation";

export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?from=/admin");
  if (!canEnterShell(session, "admin")) redirect("/pos");

  return <div data-app-shell="admin" className="min-h-full bg-[#f4f7fb]">{children}</div>;
}
