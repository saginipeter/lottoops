import { Suspense } from "react";
import Image from "next/image";
import { ShieldCheck, BarChart3, Layers, Tv, ArrowUpRight, LockKeyhole } from "lucide-react";
import { LoginForm } from "./login-form";

const features = [
  { icon: Layers, label: "Inventory control", sub: "Track every pack from receiving to sale" },
  { icon: BarChart3, label: "Shift reconciliation", sub: "Close shifts with a clear operational record" },
  { icon: ShieldCheck, label: "Role-based access", sub: "Give every team member the right level of access" },
  { icon: Tv, label: "Live display board", sub: "Keep the sales floor current automatically" },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#eef1f6] text-text lg:grid lg:grid-cols-[minmax(460px,0.92fr)_minmax(520px,1.08fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#17233f] lg:flex lg:flex-col lg:px-14 lg:py-10">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(101,209,239,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(101,209,239,0.07)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="pointer-events-none absolute right-[-11rem] top-[-11rem] h-[34rem] w-[34rem] border-[5rem] border-[#0d82a6]/20" />
        <div className="pointer-events-none absolute bottom-[-15rem] left-[-9rem] h-[30rem] w-[30rem] border-[4rem] border-white/[0.04]" />

        <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-7">
          <div className="flex items-center gap-4">
            <Image src="/brand/lottoops-logo-new.png" alt="LottoOps" width={180} height={64} className="h-14 w-14 object-contain" priority />
            <div className="h-8 w-px bg-white/20" />
            <div><p className="text-sm font-black tracking-wide text-white">LottoOps</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Management Console</p></div>
          </div>
          <span className="border border-[#65d1ef]/30 bg-[#0d82a6]/15 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#65d1ef]">Secure access</span>
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center py-12">
          <div className="max-w-[500px]">
            <div className="mb-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.25em] text-[#65d1ef]"><span className="h-px w-8 bg-[#65d1ef]" />Store operations console</div>
            <h1 className="max-w-[480px] text-5xl font-black leading-[1.02] tracking-[-0.045em] text-white xl:text-6xl">One console.<br /><span className="text-[#65d1ef]">Every shift.</span></h1>
            <p className="mt-6 max-w-[430px] text-[15px] leading-7 text-white/55">LottoOps brings receiving, inventory, sales, displays, and reporting into one controlled workspace for lottery retailers.</p>
          </div>

          <div className="mt-12 grid max-w-[520px] grid-cols-2 gap-px border border-white/10 bg-white/10">
            {features.map(({ icon: Icon, label, sub }, index) => (
              <div key={label} className="group relative bg-[#17233f] p-5 transition-colors hover:bg-[#203254]">
                <div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center border border-[#65d1ef]/25 bg-[#0d82a6]/15 text-[#65d1ef]"><Icon size={17} /></span><span className="font-mono text-[10px] text-white/25">0{index + 1}</span></div>
                <p className="mt-6 text-sm font-bold text-white/90">{label}</p>
                <p className="mt-1 text-xs leading-5 text-white/40">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
          <span>Authorized staff access only</span>
          <span>© {new Date().getFullYear()} LottoOps</span>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 sm:px-10 lg:px-16">
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
