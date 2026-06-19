import { LucideIcon } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Panel } from "@/components/ui/panel";

interface ComingSoonProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  description: string;
}

export function ComingSoon({ title, subtitle, icon: Icon, description }: ComingSoonProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header title={title} subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        <Panel className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft text-text-secondary">
            <Icon size={22} strokeWidth={1.75} />
          </div>
          <p className="text-base font-semibold text-text">
            {title} is next on the build list
          </p>
          <p className="max-w-sm text-sm text-text-secondary">{description}</p>
        </Panel>
      </div>
    </div>
  );
}
