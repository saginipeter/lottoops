import { Suspense } from "react";
import Image from "next/image";
import { ShieldCheck, BarChart3, Layers, Tv } from "lucide-react";
import { LoginForm } from "./login-form";

const features = [
  {
    icon: Layers,
    label: "Display slot management",
    sub: "Track every active game on the floor",
  },
  {
    icon: BarChart3,
    label: "Shift reconciliation",
    sub: "Open and close shifts in one click",
  },
  {
    icon: ShieldCheck,
    label: "Role-based access",
    sub: "Owner, Manager, Shift Lead, and Employee permissions",
  },
  {
    icon: Tv,
    label: "Live TV display board",
    sub: "Auto-refreshes every 15 seconds",
  },
];

export default function LoginPage() {
  return (
    <div className="flex h-screen w-full">
      {/* Left panel — enterprise feature list */}
      <div className="relative hidden w-[420px] shrink-0 flex-col justify-between overflow-hidden bg-sidebar px-10 py-10 lg:flex">

        {/* Logo */}
        <div className="relative z-10">
          <Image
            src="/brand/lottoops-logo.png"
            alt="LottoOps"
            width={180}
            height={60}
            className="h-11 w-auto"
            priority
          />
          <p className="mt-1.5 text-[10px] uppercase tracking-widest text-white/35">
            Texas Lottery
          </p>
        </div>

        {/* Operational copy */}
        <div className="relative z-10">
          <h1 className="text-[26px] font-medium leading-snug text-white">
            Lottery operations,
            <br />
            <span className="text-white/50">managed with control.</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/45">
            Operational control center for lottery retailers. Manage displays,
            track packs, and reconcile shifts in real time.
          </p>

          <ul className="mt-8 flex flex-col gap-4">
            {features.map(({ icon: Icon, label, sub }) => (
              <li key={label} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/8">
                  <Icon size={14} className="text-white/60" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80">{label}</p>
                  <p className="text-xs text-white/35">{sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-[10px] text-white/20">
          © {new Date().getFullYear()} LottoOps · For authorized store staff only
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-bg px-6">
        {/* Mobile logo (only visible < lg) */}
        <div className="mb-8 lg:hidden">
          <Image
            src="/brand/lottoops-logo.png"
            alt="LottoOps"
            width={144}
            height={48}
            className="h-9 w-auto"
            priority
          />
        </div>

        <div className="w-full max-w-[360px]">
          <div className="mb-6 border-t border-border pt-3">
            <h2 className="text-xl font-medium text-text">Sign in</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Enter store credentials to continue
            </p>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>

        </div>
      </div>
    </div>
  );
}
