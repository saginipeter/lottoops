import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { prisma } from "@/lib/prisma";
import { ConsoleTopBar } from "@/components/layout/console-top-bar";
import { InactivityGuard } from "@/components/auth/inactivity-guard";

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
      <ConsoleTopBar user={user} />
      {session && <InactivityGuard role={session.role} />}
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        {session?.impersonatedBy && <ImpersonationBanner adminName={session.impersonatedBy.name} />}
        {children}
      </main>
    </div>
  );
}
