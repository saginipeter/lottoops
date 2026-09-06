"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { Panel } from "@/components/ui/panel";

interface OnboardingChecklistProps {
  isOwner: boolean;
}

const steps = [
  { title: "Confirm store profile", description: "Add the store number, location address, phone, and timezone.", href: "/owner/stores", ownerOnly: true },
  { title: "Register terminals and scanners", description: "Add each register, phone, or customer display and its scanner details.", href: "/settings" },
  { title: "Create staff accounts", description: "Give every employee an individual login and unique password.", href: "/settings/users" },
  { title: "Set manager approval PIN", description: "Protect reversals and sensitive ticket corrections.", href: "/settings" },
  { title: "Receive your first shipment", description: "Scan packs into receiving and confirm them to Back Stock.", href: "/inventory/receive" },
  { title: "Assign a display pack", description: "Move a Back Stock pack to an assigned display position.", href: "/display-slots" },
  { title: "Open a shift and complete the audit", description: "Record beginning readings before ticket sales begin.", href: "/shifts" },
  { title: "Verify the customer display", description: "Open the TV display and confirm active games are visible.", href: "/tv-display" },
];

export function OnboardingChecklist({ isOwner }: OnboardingChecklistProps) {
  const visibleSteps = steps.filter((step) => !step.ownerOnly || isOwner);
  return (
    <div className="space-y-4">
      <Panel className="border-accent/30 bg-surface-soft p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Guided setup</p>
        <h2 className="mt-1 text-xl font-semibold text-text">Get your store ready for daily operations</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">Work through these steps in order. Each link opens the real setup surface so your configuration is saved immediately.</p>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2">
        {visibleSteps.map((step, index) => (
          <Link key={step.title} href={step.href} className="group block">
            <Panel className="h-full p-4 transition-colors group-hover:border-accent/60">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-text-tertiary"><Circle size={20} /></div>
                <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Step {index + 1}</p><h3 className="mt-1 font-semibold text-text">{step.title}</h3><p className="mt-1 text-sm text-text-secondary">{step.description}</p></div>
                <ArrowRight size={17} className="mt-1 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-1 group-hover:text-accent" />
              </div>
            </Panel>
          </Link>
        ))}
      </div>
      <Panel className="p-4"><p className="flex items-center gap-2 text-sm font-medium text-text"><CheckCircle2 size={16} className="text-emerald-600" /> Setup progress is verified by the linked operational screens.</p></Panel>
    </div>
  );
}
