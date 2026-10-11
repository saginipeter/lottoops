import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

interface OwnerShellHeaderProps {
  title: string;
  subtitle: string;
  context: string;
  backHref?: string;
  backLabel?: string;
}

export function OwnerShellHeader({ title, subtitle, context, backHref = "/", backLabel = "Console" }: OwnerShellHeaderProps) {
  return (
    <header className="flex min-h-[48px] shrink-0 flex-wrap items-center gap-3 border-b border-border bg-surface px-3 py-2 text-text sm:px-5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-black uppercase tracking-[0.08em]">{title}</h1>
          <p className="truncate text-xs text-text-secondary">{subtitle} · {context}</p>
        </div>
        <Link href={backHref} className="inline-flex min-h-10 items-center gap-2 border-2 border-chrome bg-chrome px-3 text-xs font-black text-white hover:bg-sidebar-active">
          {backHref === "/" ? <Home size={15} /> : <ArrowLeft size={15} />}
          <span className="hidden sm:inline">{backLabel}</span>
        </Link>
    </header>
  );
}
