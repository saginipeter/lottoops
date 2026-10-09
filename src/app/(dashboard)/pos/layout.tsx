import { requireShellSession } from "@/lib/require-shell-session";

export default async function PosShellLayout({ children }: { children: React.ReactNode }) {
  await requireShellSession("pos");

  return <div data-app-shell="pos" className="min-h-full">{children}</div>;
}
