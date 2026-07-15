import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";
import { UsersManager } from "@/components/settings/users-manager";

export default async function UsersSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "MANAGER" && session.role !== "OWNER") redirect("/settings");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Staff Management"
        subtitle="Add staff, assign roles, and manage access"
      />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <UsersManager currentUserRole={session.role as "OWNER" | "MANAGER" | "SHIFT_LEAD" | "EMPLOYEE"} />
      </div>
    </div>
  );
}
