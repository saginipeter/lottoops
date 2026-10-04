import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Home, Store } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read session server-side to populate the POS console header.
  // Middleware already guarantees a valid session exists by the time
  // this layout renders, so the null fallback is just a safety net.
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const store = session && session.role !== "OWNER" && prisma
    ? await prisma.store.findUnique({
        where: { id: session.storeId },
        select: { storeNumber: true, address: true, phone: true, timezone: true },
      })
    : null;

  const user = session
    ? {
        name: session.name,
        role: session.role,
        storeName: session.role === "OWNER" ? "All Stores" : session.storeName ?? "My Store",
        grantedPermissions: session.grantedPermissions ?? [],
        storeNumber: store?.storeNumber ?? null,
        storeAddress: store?.address ?? null,
        storePhone: store?.phone ?? null,
        storeTimezone: store?.timezone ?? null,
        initials: session.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2),
      }
    : {
        name: "Staff",
        role: "EMPLOYEE" as const,
        storeName: "Store",
        storeNumber: null,
        storeAddress: null,
        storePhone: null,
        storeTimezone: null,
        initials: "?",
        grantedPermissions: [],
      };

  return (
    <div className="dashboard-shell flex h-screen min-w-0 flex-col overflow-hidden bg-bg">
      <div className="flex min-h-[58px] shrink-0 items-center gap-3 border-b border-chrome-border bg-chrome px-4 text-white sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="LottoOps Store Operations Console home">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-accent/50 bg-accent/20 text-accent"><Store size={18} /></span>
          <span className="min-w-0"><span className="block truncate text-sm font-bold tracking-wide">LottoOps</span><span className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50 sm:block">Store Operations Console</span></span>
        </Link>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <div className="hidden text-right sm:block"><p className="text-xs font-semibold text-white/90">{user.storeName}</p><p className="text-[10px] uppercase tracking-wider text-white/45">{user.role.replaceAll("_", " ")}</p></div>
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 border border-white/15 bg-white/10 px-3 text-xs font-semibold hover:bg-white/15"><Home size={14} /> <span className="hidden sm:inline">Console</span></Link>
          <LogoutButton label="Sign out" className="inline-flex min-h-10 items-center gap-2 border border-white/15 bg-transparent px-3 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white" />
        </div>
      </div>
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {session?.impersonatedBy && <ImpersonationBanner adminName={session.impersonatedBy.name} />}
        {children}
      </main>
    </div>
  );
}
