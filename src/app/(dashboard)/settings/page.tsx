import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Panel } from "@/components/ui/panel";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { ExternalLink, Settings, Tv, Users } from "lucide-react";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";
import { ApprovalPinCard } from "@/components/settings/approval-pin-card";
import { DeviceRegistryPanel } from "@/components/settings/device-registry-panel";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const isManagerOrOwner = session.role === "MANAGER" || session.role === "OWNER";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title="Settings"
        subtitle="Store details, staff roles, and display preferences"
      />

      <PageToolbar
        left={<span className="text-xs text-text-secondary">Security and configuration controls</span>}
        center={<span>Ctrl+F Search Settings</span>}
        right={<span className="text-xs text-text-tertiary">Role: {session.role}</span>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
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

          {isManagerOrOwner && (
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
                Roles: Owner | Manager | Shift Lead | Employee
              </p>
            </Panel>
          )}

          {isManagerOrOwner && <ApprovalPinCard />}

          {isManagerOrOwner && <DeviceRegistryPanel />}

          <Panel className={`h-full p-5 ${isManagerOrOwner ? "" : "md:col-span-2"}`}>
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

      <StatusBar
        left={<span>Managed Store: {session.storeName}</span>}
        center={<span>{isManagerOrOwner ? "Manager controls enabled" : "Limited access mode"}</span>}
        right={<span>Audit sensitive changes</span>}
      />
    </div>
  );
}
