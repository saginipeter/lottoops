import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Panel } from "@/components/ui/panel";
import { ExternalLink, Settings, Tv, Users } from "lucide-react";

export default function SettingsPage() {
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

          <Panel className="h-full p-5">
            <div className="mb-3 inline-flex rounded-lg bg-purple-100 p-2 text-purple-700">
              <Users size={18} />
            </div>
            <h3 className="text-base font-semibold text-text">Staff Roles</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Active roles: Manager, Clerk, Viewer. API permissions are enforced for sensitive actions.
            </p>
          </Panel>

          <Panel className="h-full p-5 md:col-span-2">
            <div className="mb-3 inline-flex rounded-lg bg-gray-100 p-2 text-gray-700">
              <Settings size={18} />
            </div>
            <h3 className="text-base font-semibold text-text">System Settings</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Additional store and operational settings can be expanded here.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
