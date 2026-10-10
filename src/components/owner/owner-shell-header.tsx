import Link from "next/link";
import { ArrowLeft, Home, Store } from "lucide-react";

interface OwnerShellHeaderProps {
  title: string;
  subtitle: string;
  context: string;
  backHref?: string;
  backLabel?: string;
}

export function OwnerShellHeader({ title, subtitle, context, backHref = "/", backLabel = "Console" }: OwnerShellHeaderProps) {
  return (
    <header className="shrink-0 border-b border-[#0d1528] bg-[#17233f] text-white shadow-[0_5px_0_rgba(13,21,40,0.18)]">
      <div className="mx-auto flex min-h-[72px] max-w-[1366px] items-center gap-4 px-4 py-3 sm:px-7">
        <Link href="/" aria-label="LottoOps console home" className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#55c4e8]/50 bg-[#087da8]/30 text-[#8be2ff]">
          <Store size={19} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8be2ff]">LottoOps owner console</p>
          <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">{title}</h1>
          <p className="truncate text-xs text-white/60">{subtitle}</p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Current view</p>
          <p className="text-sm font-bold text-white/90">{context}</p>
        </div>
        <Link href={backHref} className="inline-flex min-h-10 items-center gap-2 border border-white/20 bg-white/10 px-3 text-xs font-black hover:bg-white/15">
          {backHref === "/" ? <Home size={15} /> : <ArrowLeft size={15} />}
          <span className="hidden sm:inline">{backLabel}</span>
        </Link>
      </div>
    </header>
  );
}
