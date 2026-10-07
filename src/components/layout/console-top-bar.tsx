"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Home, Store } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

interface ConsoleTopBarProps {
  user: {
    name: string;
    role: string;
    storeName: string;
  };
}

export function ConsoleTopBar({ user }: ConsoleTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isConsole = pathname === "/";

  if (isConsole) return null;

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  return (
    <div className="flex min-h-[58px] shrink-0 items-center gap-3 border-b border-chrome-border bg-chrome px-4 text-white sm:px-6">
      <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="LottoOps Store Operations Console home">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-accent/50 bg-accent/20 text-accent"><Store size={18} /></span>
        <span className="min-w-0"><span className="block truncate text-sm font-bold tracking-wide">LottoOps</span><span className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50 sm:block">Store Operations Console</span></span>
      </Link>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden text-right sm:block"><p className="text-xs font-semibold text-white/90">{user.storeName}</p><p className="text-[10px] uppercase tracking-wider text-white/45">{user.role.replaceAll("_", " ")}</p></div>
        {!isConsole && <button type="button" onClick={goBack} className="inline-flex min-h-10 items-center gap-2 border border-white/20 bg-white/10 px-3 text-xs font-semibold hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-accent" aria-label="Go back to the previous page"><ArrowLeft size={16} /> <span>Back</span></button>}
        <Link href="/" className="inline-flex min-h-10 items-center gap-2 border border-white/15 bg-white/10 px-3 text-xs font-semibold hover:bg-white/15"><Home size={14} /> <span className="hidden sm:inline">Console</span></Link>
        <LogoutButton label="Sign out" className="inline-flex min-h-10 items-center gap-2 border border-white/15 bg-transparent px-3 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white" />
      </div>
    </div>
  );
}
