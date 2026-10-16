import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import ReceiveWizard, { type WizardStep } from "@/components/receive/receive-wizard";

interface ReceiveStepPageProps {
  params: Promise<{ step: string }>;
}

export default async function ReceiveStepPage({ params }: ReceiveStepPageProps) {
  const { step: rawStep } = await params;
  const stepNumber = Number(rawStep);

  if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 4) {
    notFound();
  }

  const step = stepNumber as WizardStep;
  const session = await getSession();
  if (!session?.storeId) redirect("/login?from=/inventory/receive");

  return <ReceiveWizard storeId={session.storeId} initialStep={step} receiverName={session.name} />;
}
