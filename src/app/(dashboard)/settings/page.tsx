import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Panel } from "@/components/ui/panel";
import { ExternalLink, Settings, Tv, Users } from "lucide-react";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const isManager = session.role === "MANAGER";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Settings"
        subtitle="Store details, staff roles, and display preferences"
      />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Panel className="h-full p-5">
            <div className="mb-3 inline-flex rounded-lg bg-blue-100 p-2 text-blue-700">
              <Tv size={18} />
            </div>
            <h3 className="text-base font-semibold text-text">TV Display</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Show active games and pack status on a customer-facing display.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/settings/tv-display"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-soft"
              >
                Open TV Settings
              </Link>
              <Link
                href="/tv-display?interval=15"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
              >
                Start Kiosk
                <ExternalLink size={14} />
              </Link>
            </div>
            <p className="mt-2 text-xs text-text-tertiary">
              Kiosk opens as full-screen board view with auto-refresh.
            </p>
          </Panel>

          {isManager && (
            <Panel className="h-full p-5">
              <div className="mb-3 inline-flex rounded-lg bg-purple-100 p-2 text-purple-700">
                <Users size={18} />
              </div>
              <h3 className="text-base font-semibold text-text">Staff Management</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Add staff members, assign roles, reset passwords, and deactivate accounts.
              </p>
              <div className="mt-4">
                <Link
                  href="/settings/users"
                  className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
                >
                  Manage Staff
                </Link>
              </div>
              <p className="mt-2 text-xs text-text-tertiary">
                Roles: Manager | Clerk | Viewer
              </p>
            </Panel>
          )}

          <Panel className={`h-full p-5 ${isManager ? "" : "md:col-span-2"}`}>
            <div className="mb-3 inline-flex rounded-lg bg-gray-100 p-2 text-gray-700">
              <Settings size={18} />
            </div>
            <h3 className="text-base font-semibold text-text">System Settings</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Store timezone, notification preferences, and advanced configuration.
            </p>
            <p className="mt-3 text-xs text-text-tertiary italic">More settings coming soon.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
