import { requireShellSession } from "@/lib/require-shell-session";

export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
  await requireShellSession("admin");

  return <div data-app-shell="admin" className="min-h-full bg-[#f4f7fb]">{children}</div>;
}
