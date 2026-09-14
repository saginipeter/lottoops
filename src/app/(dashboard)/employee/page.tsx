import Link from "next/link";
import { ArrowRight, ClipboardCheck, Radio, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { StatusBar } from "@/components/ui/status-bar";
import { getSession } from "@/lib/get-session";
import { LogoutButton } from "@/components/auth/logout-button";

const actions = [
  {
    href: "/inventory/live-scan",
    label: "Live scan",
    description: "Scan a ticket or pack barcode and keep sales moving.",
    icon: Radio,
    tone: "bg-accent text-white",
  },
  {
    href: "/shifts",
    label: "Shift control",
    description: "Open your shift, review activity, and complete reconciliation.",
    icon: ClipboardCheck,
    tone: "bg-surface border border-border text-accent",
  },
];

export default async function EmployeePage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/employee");
  if (session.role !== "EMPLOYEE") redirect("/");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
      <Header title="Employee workspace" subtitle="Fast access to today’s store work" />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <div className="border border-border bg-surface p-5 shadow-[0_12px_36px_rgba(23,35,63,0.08)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">LottoOps mobile</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">Welcome, {session.name.split(" ")[0]}</h1>
                <p className="mt-2 text-sm text-text-secondary">{session.storeName ?? "Your store"} · Employee access</p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-success/25 bg-success-soft text-success-soft-text"><ShieldCheck size={20} /></div>
            </div>
          </div>

          <section className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="Employee actions">
            {actions.map(({ href, label, description, icon: Icon, tone }) => (
              <Link key={href} href={href} className={`group min-h-44 p-5 transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-accent ${tone}`}>
                <div className="flex items-start justify-between gap-3"><Icon size={24} /><ArrowRight size={19} className="transition-transform group-hover:translate-x-1" /></div>
                <h2 className="mt-8 text-lg font-semibold">{label}</h2>
                <p className="mt-1 text-sm leading-6 opacity-75">{description}</p>
              </Link>
            ))}
          </section>

          <div className="mt-5 border border-border bg-surface-soft p-4 text-sm text-text-secondary">
            <p className="font-semibold text-text">Keep the scanner ready</p>
            <p className="mt-1">Use Live scan for ticket sales. If a pack is locked or a scan is rejected, stop and ask a manager before trying again.</p>
          </div>

          <LogoutButton label="Sign out" className="mt-5 min-h-11 w-auto px-0 text-sm font-semibold text-text-secondary hover:bg-transparent hover:text-text" />
        </div>
      </main>
      <StatusBar left={<span>Employee mode</span>} center={<span>Scan accurately · Ask before correcting</span>} right={<span className="text-success-soft-text">Protected session</span>} />
    </div>
  );
}
