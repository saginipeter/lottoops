import { cookies } from "next/headers";
import { Sidebar } from "@/components/layout/sidebar";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

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

  const user = session
    ? {
        name: session.name,
        role: session.role,
        storeName: session.role === "OWNER" ? "All Stores" : session.storeName ?? "My Store",
        grantedPermissions: session.grantedPermissions ?? [],
        initials: session.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2),
      }
    : { name: "Staff", role: "EMPLOYEE" as const, storeName: "Store", initials: "?", grantedPermissions: [] };

  const showSidebar = user.role !== "EMPLOYEE";

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {showSidebar && <Sidebar user={user} />}
      <main className="min-w-0 flex flex-1 flex-col overflow-hidden pb-14 sm:pb-0">{children}</main>
    </div>
  );
}
