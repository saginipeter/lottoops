import { ComingSoon } from "@/components/layout/coming-soon";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      subtitle="Store details, roles, and display preferences"
      icon={Settings}
      description="Manage manager, clerk, and viewer permissions, and configure store-level preferences for the TV display board."
    />
  );
}
