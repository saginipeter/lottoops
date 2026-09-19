import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ListChecks,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { StatusBar } from "@/components/ui/status-bar";
import { getSession } from "@/lib/get-session";
import { LogoutButton } from "@/components/auth/logout-button";
import { prisma } from "@/lib/prisma";
import { EmployeeDeviceSetup } from "@/components/pwa/employee-device-setup";

type TaskState = "complete" | "ready" | "locked";

interface EmployeeTask {
  label: string;
  description: string;
  href: string;
  state: TaskState;
  action: string;
}

interface EmployeePageProps {
  searchParams?: Promise<{ terminal?: string }>;
}

export default async function EmployeePage({ searchParams }: EmployeePageProps) {
  const session = await getSession();
  if (!session) redirect("/login?from=/employee");
  if (session.role !== "EMPLOYEE") redirect("/");

  const resolvedSearchParams = (await searchParams) ?? {};
  const terminalId =
    typeof resolvedSearchParams.terminal === "string" && /^T[1-4]$/i.test(resolvedSearchParams.terminal)
      ? resolvedSearchParams.terminal.toUpperCase()
      : "T1";
  let openShift: { id: string } | null = null;
  let audit: {
    status: string;
    lines: Array<{ beginningPhysicalTicket: number | null; endingPhysicalTicket: number | null }>;
  } | null = null;

  if (prisma) {
    try {
      const openShiftRows = await prisma.$queryRawUnsafe(
        `SELECT id FROM shifts WHERE "storeId" = $1 AND status = 'OPEN' ORDER BY "openedAt" DESC LIMIT 1`,
        session.storeId,
      ) as Array<{ id: string }>;
      openShift = openShiftRows[0] ?? null;
    } catch {
      openShift = await prisma.shift.findFirst({
        where: { storeId: session.storeId, status: "OPEN" },
        orderBy: { openedAt: "desc" },
        select: { id: true },
      });
    }

    if (openShift) {
      try {
        audit = await prisma.inventoryAudit.findUnique({
          where: { shiftId: openShift.id },
          select: {
            status: true,
            lines: { select: { beginningPhysicalTicket: true, endingPhysicalTicket: true } },
          },
        });
      } catch {
        audit = null;
      }
    }
  }

  const shiftOpen = Boolean(openShift);
  const hasAuditLines = Boolean(audit?.lines.length);
  const beginningAuditComplete = Boolean(
    hasAuditLines && audit?.lines.every((line) => line.beginningPhysicalTicket !== null),
  );
  const endingAuditComplete = Boolean(
    hasAuditLines && audit?.lines.every((line) => line.endingPhysicalTicket !== null),
  );
  const auditComplete = audit?.status === "COMPLETED";

  const tasks: EmployeeTask[] = [
    {
      label: "Open shift",
      description: "Start the terminal shift and snapshot active display packs.",
      href: `/shifts?terminal=${terminalId}`,
      state: shiftOpen ? "complete" : "ready",
      action: shiftOpen ? "Open" : "Start",
    },
    {
      label: "Beginning physical audit",
      description: "Scan each display pack and record its starting ticket.",
      href: `/shifts?terminal=${terminalId}#physical-audit`,
      state: beginningAuditComplete ? "complete" : shiftOpen ? "ready" : "locked",
      action: beginningAuditComplete ? "Done" : "Audit",
    },
    {
      label: "Live ticket scanning",
      description: "Record ticket movement throughout the active shift.",
      href: `/inventory/live-scan?terminal=${terminalId}`,
      state: shiftOpen ? "ready" : "locked",
      action: "Scan",
    },
    {
      label: "Ending physical audit",
      description: "Verify remaining tickets before closing the shift.",
      href: `/shifts?terminal=${terminalId}#physical-audit`,
      state: auditComplete || endingAuditComplete ? "complete" : beginningAuditComplete ? "ready" : "locked",
      action: auditComplete || endingAuditComplete ? "Done" : "Audit",
    },
    {
      label: "Close shift",
      description: "Finalize sales and hand off any unresolved variance.",
      href: `/shifts?terminal=${terminalId}`,
      state: auditComplete ? "ready" : "locked",
      action: "Close",
    },
  ];

  const completedTasks = tasks.filter((task) => task.state === "complete").length;
  const nextTask = tasks.find((task) => task.state === "ready");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
      <Header title="Employee workspace" subtitle="Guided shift tasks and fast scanning" />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="border border-border bg-surface p-5 shadow-[0_12px_36px_rgba(23,35,63,0.08)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">LottoOps employee</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">Welcome, {session.name.split(" ")[0]}</h1>
                <p className="mt-1 text-sm text-text-secondary">{session.storeName ?? "Your store"} · Terminal {terminalId}</p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-success/25 bg-success-soft text-success-soft-text"><ShieldCheck size={20} /></div>
            </div>
            <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-4 border-t border-border pt-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Shift progress</p>
                <p className="mt-1 text-sm font-semibold text-text">{completedTasks} of {tasks.length} workflow tasks completed</p>
              </div>
              <span className={`px-3 py-1.5 text-xs font-semibold ${shiftOpen ? "bg-success-soft text-success-soft-text" : "bg-warning-soft text-warning-soft-text"}`}>
                {shiftOpen ? "Shift open" : "No open shift"}
              </span>
            </div>
          </div>

          <nav className="mt-3 grid grid-cols-4 gap-2" aria-label="Select terminal">
            {(["T1", "T2", "T3", "T4"] as const).map((terminal) => (
              <Link key={terminal} href={`/employee?terminal=${terminal}`} className={`flex min-h-11 items-center justify-center border text-sm font-semibold ${terminalId === terminal ? "border-accent bg-accent text-white" : "border-border bg-surface text-text-secondary"}`}>{terminal}</Link>
            ))}
          </nav>

          <EmployeeDeviceSetup terminalId={terminalId} />

          {nextTask && (
            <Link href={nextTask.href} className="group mt-4 flex min-h-24 items-center gap-4 bg-accent p-4 text-white active:scale-[0.99]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-white/25"><ListChecks size={21} /></div>
              <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">Next task</p><p className="mt-1 text-lg font-semibold">{nextTask.label}</p><p className="mt-0.5 text-xs text-white/75">{nextTask.description}</p></div>
              <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
            </Link>
          )}

          <section className="mt-4 border border-border bg-surface" aria-labelledby="shift-checklist-title">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div><p className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Today</p><h2 id="shift-checklist-title" className="text-base font-semibold text-text">Shift checklist</h2></div>
              <ClipboardCheck size={19} className="text-accent" />
            </div>
            <div className="divide-y divide-border">
              {tasks.map((task) => <TaskRow key={task.label} task={task} />)}
            </div>
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Employee tools">
            <Link href={`/inventory/live-scan?terminal=${terminalId}`} className="group min-h-32 bg-chrome p-4 text-white active:scale-[0.99]">
              <div className="flex items-start justify-between"><Radio size={21} /><ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></div>
              <h2 className="mt-5 text-base font-semibold">Open live scanner</h2><p className="mt-1 text-xs text-white/70">Camera, barcode reader, manual entry, and offline queue.</p>
            </Link>
            <Link href={`/inventory/live-scan?terminal=${terminalId}#report-ticket`} className="group min-h-32 border border-warning/40 bg-warning-soft p-4 text-warning-soft-text active:scale-[0.99]">
              <div className="flex items-start justify-between"><AlertTriangle size={21} /><ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></div>
              <h2 className="mt-5 text-base font-semibold">Manager handoff</h2><p className="mt-1 text-xs opacity-75">Report damaged, disputed, or blocked tickets for review.</p>
            </Link>
          </section>

          <LogoutButton label="Sign out" className="mt-4 min-h-11 w-auto px-0 text-sm font-semibold text-text-secondary hover:bg-transparent hover:text-text" />
        </div>
      </main>
      <StatusBar left={<span>Employee mode</span>} center={<span>{nextTask ? `Next: ${nextTask.label}` : "Workflow complete"}</span>} right={<span className="text-success-soft-text">Protected session</span>} />
    </div>
  );
}

function TaskRow({ task }: { task: EmployeeTask }) {
  const Icon = task.state === "complete" ? CheckCircle2 : Circle;
  const disabled = task.state === "locked";
  const content = (
    <>
      <Icon size={20} className={task.state === "complete" ? "text-success" : task.state === "ready" ? "text-accent" : "text-text-tertiary"} />
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text">{task.label}</span><span className="mt-0.5 block text-xs text-text-secondary">{task.description}</span></span>
      <span className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${task.state === "complete" ? "bg-success-soft text-success-soft-text" : task.state === "ready" ? "bg-accent-soft text-accent" : "bg-surface-soft text-text-tertiary"}`}>{task.state === "locked" ? "Waiting" : task.action}</span>
      {!disabled && <ArrowRight size={16} className="text-text-tertiary" />}
    </>
  );

  return disabled
    ? <div className="flex min-h-20 items-center gap-3 px-4 py-3 opacity-65" aria-disabled="true">{content}</div>
    : <Link href={task.href} className="flex min-h-20 items-center gap-3 px-4 py-3 hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-accent">{content}</Link>;
}
