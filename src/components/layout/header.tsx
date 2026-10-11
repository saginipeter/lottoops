import { BillingStatus } from "@/components/billing/billing-status";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="flex min-h-[48px] shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface px-3 py-2 text-text sm:flex-nowrap sm:px-5">
      <span className="min-w-0 flex-1 truncate text-sm font-black uppercase tracking-[0.08em] text-text">{title}</span>
      {subtitle && (
        <span className="max-w-full truncate text-xs text-text-secondary sm:max-w-[55%]">{subtitle}</span>
      )}
      <BillingStatus />
      {actions && <div className="flex max-w-full items-center gap-2">{actions}</div>}
    </div>
  );
}
