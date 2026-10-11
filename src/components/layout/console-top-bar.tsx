"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";

interface ConsoleTopBarProps {
  user: {
    name: string;
    role: string;
    storeName: string;
  };
}

export function ConsoleTopBar({ user }: ConsoleTopBarProps) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  return (
    <header className="console-header flex min-h-[68px] shrink-0 items-center gap-3 border-b-2 border-[#075f7d] bg-[#0d82a6] px-3 text-white shadow-[0_3px_0_rgba(7,95,125,0.2)] sm:px-6">
      <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="LottoOps Management Console home">
        <Image src="/brand/lottoops-logo-new.png" alt="LottoOps" width={42} height={42} priority className="h-9 w-9 shrink-0 object-contain" />
        <span className="min-w-0"><span className="block truncate text-xl font-black tracking-tight">LottoOps</span><span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/75">Management Console</span></span>
      </Link>
      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <div className="hidden text-center text-[10px] sm:block"><p className="text-white/70">User</p><p className="max-w-28 truncate font-black">{user.name}</p></div>
        <div className="hidden text-center text-[10px] sm:block"><p className="text-white/70">Role</p><p className="font-black">{user.role.replaceAll("_", " ")}</p></div>
        <div className="hidden text-center text-[10px] md:block"><p className="text-white/70">Store</p><p className="max-w-32 truncate font-black">{user.storeName}</p></div>
        <button type="button" onClick={goBack} className="inline-flex min-h-11 items-center gap-2 border-2 border-white/40 bg-white/10 px-4 text-sm font-black hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white" aria-label="Go back to the previous page"><span aria-hidden="true">←</span> Back</button>
        <LogoutButton label="Sign out" className="inline-flex min-h-11 items-center gap-2 border-2 border-white/40 bg-white/10 px-4 text-sm font-black text-white hover:bg-white/20" />
      </div>
    </header>
  );
}
