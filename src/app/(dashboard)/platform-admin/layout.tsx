import { requireShellSession } from "@/lib/require-shell-session";

export default async function PlatformAdminShellLayout({ children }: { children: React.ReactNode }) {
  await requireShellSession("platform-admin");

  return <div data-app-shell="platform-admin" className="min-h-full bg-[#f4f7fb]">{children}</div>;
}
