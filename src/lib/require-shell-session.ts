import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import { canEnterShell, type AppShell } from "@/lib/shell-routing";

export async function requireShellSession(shell: AppShell) {
  const session = await getSession();
  if (!session) redirect(`/login?from=/${shell}`);
  if (!canEnterShell(session, shell)) redirect(shell === "pos" ? "/admin" : "/pos");
  return session;
}
