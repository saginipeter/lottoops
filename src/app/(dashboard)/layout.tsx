import { cookies } from "next/headers";
import { Sidebar } from "@/components/layout/sidebar";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read session server-side to pass real user info to the sidebar.
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

  const showSidebar = user.role !== "EMPLOYEE";

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {showSidebar && <Sidebar user={user} />}
      <main className="min-w-0 flex flex-1 flex-col overflow-hidden">
        {session?.impersonatedBy && <ImpersonationBanner adminName={session.impersonatedBy.name} />}
        {children}
      </main>
    </div>
  );
}
