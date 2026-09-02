import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";
import { UsersManager } from "@/components/settings/users-manager";
import { ManagerStoreAssignments } from "@/components/settings/manager-store-assignments";

export default async function UsersSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "MANAGER" && session.role !== "OWNER") redirect("/settings");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title="Staff Management"
        subtitle="Add staff, assign roles, and manage access"
      />

      <PageToolbar
        left={<span className="text-xs text-text-secondary">Role-based account controls</span>}
        center={<span>Ctrl+F Search Users | Ctrl+S Save</span>}
        right={<span className="text-xs text-text-tertiary">Access: {session.role}</span>}
      />

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {session.role === "OWNER" && <ManagerStoreAssignments />}
        <UsersManager currentUserRole={session.role as "OWNER" | "MANAGER" | "SHIFT_LEAD" | "EMPLOYEE"} />
      </div>

      <StatusBar
        left={<span>User management mode</span>}
        center={<span>Changes affect login and permissions immediately</span>}
        right={<span>Review before save</span>}
      />
    </div>
  );
}
