import { getSession } from "@/lib/get-session";
import { canEnterShell } from "@/lib/shell-routing";
import { redirect } from "next/navigation";

export default async function PlatformAdminShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?from=/platform-admin");
  if (!canEnterShell(session, "platform-admin")) redirect("/admin");

  return <div data-app-shell="platform-admin" className="min-h-full bg-[#f4f7fb]">{children}</div>;
}
