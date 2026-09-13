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
    <main className="min-h-screen bg-bg text-text lg:grid lg:grid-cols-[minmax(460px,0.9fr)_minmax(520px,1.1fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-sidebar-deep lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div className="pointer-events-none absolute -right-32 top-[-14rem] h-[34rem] w-[34rem] rounded-full bg-magenta/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-amber/15 blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
<Image src="/brand/lottoops-logo-new.png" alt="LottoOps" width={180} height={64} className="h-14 w-14 object-contain" priority />
          <span className="h-6 w-px bg-white/20" />
          <span className="text-[10px] uppercase tracking-[0.22em] text-white/45">Operations platform</span>
        </div>

        <div className="relative z-10 max-w-[470px]">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber">Store operations console</p>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-white xl:text-5xl">
            Run every shift with confidence.
          </h1>
          <p className="mt-5 max-w-[410px] text-[15px] leading-7 text-white/55">
            LottoOps brings receiving, inventory, sales, displays, and reporting into one controlled workspace for lottery retailers.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {features.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="border border-white/10 bg-white/[0.045] p-4">
                <Icon size={18} className="text-amber" />
                <p className="mt-5 text-sm font-semibold text-white/90">{label}</p>
                <p className="mt-1 text-xs leading-5 text-white/40">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-[10px] uppercase tracking-[0.14em] text-white/30">
          <span>Authorized staff access only</span>
          <span>© {new Date().getFullYear()} LottoOps</span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-10 lg:px-16">
        <div className="w-full max-w-[430px]">
          <div className="mb-10 flex items-center justify-between lg:hidden">
<Image src="/brand/lottoops-logo-new.png" alt="LottoOps" width={156} height={56} className="h-12 w-12 object-contain" priority />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Secure access</span>
          </div>

          <div className="border border-border bg-surface shadow-[0_18px_60px_rgba(23,35,63,0.08)]">
            <div className="border-b border-border bg-surface-soft/40 px-7 py-6 sm:px-9">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Welcome back</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-text">Sign in to LottoOps</h2>
                  <p className="mt-2 text-sm text-text-secondary">Access your store operations workspace.</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-accent/20 bg-accent-soft text-accent"><LockKeyhole size={18} /></div>
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
