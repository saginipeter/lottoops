import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { getSession } from "@/lib/get-session";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "OWNER" && session.role !== "MANAGER") redirect("/");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header title="Store Onboarding" subtitle="Guided setup for LottoOps daily operations" />
      <PageToolbar left={<span className="text-xs text-text-secondary">Store: {session.storeName}</span>} center={<span>Setup checklist</span>} right={<span className="text-xs text-text-tertiary">{session.role}</span>} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5"><OnboardingChecklist isOwner={session.role === "OWNER"} /></div>
      <StatusBar left={<span>Onboarding</span>} center={<span>Complete setup in order</span>} right={<span>Operational readiness</span>} />
    </div>
  );
}
