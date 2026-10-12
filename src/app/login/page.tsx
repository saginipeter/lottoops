import { Suspense } from "react";
import Image from "next/image";
import { ShieldCheck, ArrowUpRight, LockKeyhole, ScanLine, PackageCheck, ChartNoAxesCombined } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#eef1f6] text-text lg:grid lg:grid-cols-[minmax(480px,1fr)_minmax(500px,0.92fr)]">
      <section className="relative flex min-h-[340px] flex-col justify-between overflow-hidden bg-[#14283d] px-6 py-6 text-white sm:px-10 sm:py-8 lg:min-h-screen lg:px-14 lg:py-10">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
        <div className="pointer-events-none absolute -right-20 top-20 h-72 w-72 border border-[#65d1ef]/20 sm:h-96 sm:w-96" />
        <div className="pointer-events-none absolute -right-10 top-32 h-56 w-56 border border-[#65d1ef]/15 sm:h-80 sm:w-80" />

        <div className="relative z-10 flex items-center gap-3">
          <Image src="/brand/lottoops-logo-new.png" alt="LottoOps" width={180} height={64} className="h-12 w-12 object-contain sm:h-14 sm:w-14" priority />
          <span className="h-8 w-px bg-white/20" />
          <div><p className="text-sm font-black tracking-wide">LottoOps</p><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/55">Management Console</p></div>
        </div>

        <div className="relative z-10 mx-auto mt-7 grid w-full max-w-[610px] gap-6 lg:mt-0 lg:gap-9">
          <div className="max-w-[540px]">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#72d4eb] sm:text-xs">Lottery retail operations</p>
            <h1 className="text-3xl font-black leading-[1.04] sm:text-5xl xl:text-6xl">Every ticket.<br /><span className="text-[#75d5e9]">Accounted for.</span></h1>
            <p className="mt-3 max-w-[450px] text-sm leading-6 text-white/70 sm:mt-4 sm:text-base">Receive stock, track the display floor, and reconcile each shift from one workspace.</p>
          </div>

          <div className="relative border border-white/20 bg-[#0d1d2d]/80 p-3 shadow-[0_18px_60px_rgba(0,0,0,.25)] sm:p-5">
            <div className="mb-3 flex items-center justify-between border-b border-white/15 pb-2 sm:mb-4 sm:pb-3">
              <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#75d5e9]">Display floor</p><p className="mt-1 text-xs font-bold text-white sm:text-sm">Pack movement at a glance</p></div>
              <span className="inline-flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-wider text-emerald-300 sm:text-[9px]"><span className="h-1.5 w-1.5 bg-emerald-300" />Live board</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3" aria-label="Illustration of lottery ticket packs on display">
              {[
                ["LUCKY 7", "#2769", "#e2a222"], ["CASH", "#2424", "#d34b3f"], ["CROSSWORD", "#2731", "#18889c"], ["BONUS", "#2710", "#7161a8"],
                ["7s", "#2390", "#34916f"], ["WORD PLAY", "#2440", "#d0659c"], ["JACKPOT", "#2601", "#be542f"], ["LUCK", "#2872", "#4f80b5"],
              ].map(([name, number, tone], index) => (
                <div key={`${name}-${number}`} className="relative aspect-[0.78] overflow-hidden border border-white/25 p-1.5 sm:p-2" style={{ background: `linear-gradient(145deg, ${tone}, #162335 82%)` }}>
                  <div className="flex h-full flex-col justify-between border border-white/20 p-1 sm:p-1.5">
                    <div className="flex items-center justify-between text-[6px] font-black uppercase text-white/75 sm:text-[7px]"><span>TX</span><span>{String(index + 1).padStart(2, "0")}</span></div>
                    <div><p className="text-center text-[9px] font-black leading-tight text-white sm:text-xs">{name}</p><p className="mt-1 text-center text-[6px] font-bold uppercase tracking-wider text-white/75 sm:text-[7px]">Scratch ticket</p></div>
                    <div className="flex justify-between border-t border-white/35 pt-1 text-[5px] font-bold uppercase text-white/80 sm:text-[6px]"><span>Display</span><span>{number}</span></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 border-t border-white/15 pt-2 text-[7px] font-black uppercase tracking-[0.12em] text-white/55 sm:mt-4 sm:pt-3 sm:text-[9px]">
              <span className="inline-flex items-center gap-1.5"><PackageCheck size={12} className="text-[#75d5e9]" />Receive</span>
              <span className="inline-flex items-center justify-center gap-1.5"><ScanLine size={12} className="text-[#75d5e9]" />Track</span>
              <span className="inline-flex items-center justify-end gap-1.5"><ChartNoAxesCombined size={12} className="text-[#75d5e9]" />Reconcile</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-5 flex items-center justify-between border-t border-white/15 pt-3 text-[9px] font-bold uppercase tracking-[0.13em] text-white/45 sm:mt-8 sm:pt-4 sm:text-[10px]">
          <span>Authorized staff access only</span>
          <span>© {new Date().getFullYear()} LottoOps</span>
        </div>
      </section>

      <section className="relative flex min-h-[560px] items-center justify-center overflow-hidden px-5 py-8 sm:px-10 lg:min-h-screen lg:px-16">
        <div className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-[#0d82a6]" />
        <div className="w-full max-w-[430px]">
          <div className="mb-10 flex items-center justify-between lg:hidden">
	<Image src="/brand/lottoops-logo-new.png" alt="LottoOps" width={156} height={56} className="h-12 w-12 object-contain" priority />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0d82a6]">Secure access</span>
          </div>

          <div className="border border-[#cfd6e3] bg-white shadow-[0_20px_60px_rgba(23,35,63,0.12)]">
            <div className="border-b border-[#cfd6e3] border-l-4 border-l-[#0d82a6] bg-[#f7f9fc] px-7 py-6 sm:px-9">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#0d82a6]">Authorized access</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.025em] text-[#17233f]">Sign in to LottoOps</h2>
                  <p className="mt-2 text-sm text-[#526078]">Access your store operations workspace.</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#0d82a6]/25 bg-[#e2f5fa] text-[#0d82a6]"><LockKeyhole size={18} /></div>
              </div>
            </div>
            <div className="px-7 py-7 sm:px-9 sm:py-8">
              <Suspense><LoginForm /></Suspense>
              <div className="mt-7 flex items-center gap-2 border-t border-border pt-5 text-[11px] leading-5 text-text-tertiary">
                <ShieldCheck size={14} className="shrink-0 text-success" />
                <span>Your account access is protected by secure session controls.</span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between text-xs text-text-tertiary">
            <span>Need access? Contact your store manager.</span>
            <span className="inline-flex items-center gap-1 text-accent"><ArrowUpRight size={13} />LottoOps</span>
          </div>
        </div>
      </section>
    </main>
  );
}
