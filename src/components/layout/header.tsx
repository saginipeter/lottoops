interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="flex min-h-[52px] shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-chrome-border bg-chrome px-3 py-2 text-white sm:h-[52px] sm:flex-nowrap sm:px-5 sm:py-0">
      <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-wide text-white">{title}</span>
      {subtitle && (
        <span className="max-w-full truncate text-xs text-[#b9c4d8] sm:max-w-[55%]">{subtitle}</span>
      )}
      {actions && <div className="flex max-w-full items-center gap-2">{actions}</div>}
    </div>
  );
}
