interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-surface px-5">
      <span className="flex-1 text-sm font-medium text-text">{title}</span>
      {subtitle && (
        <span className="text-xs text-text-tertiary">{subtitle}</span>
      )}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
