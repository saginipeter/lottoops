import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import ReceiveWizard, { type WizardStep } from "@/components/receive/receive-wizard";

interface ReceiveStepPageProps {
  params: Promise<{ step: string }>;
}

export default async function ReceiveStepPage({ params }: ReceiveStepPageProps) {
  const session = await getSession();
  if (!session) redirect("/login?from=/inventory/receive");
  const { step: rawStep } = await params;
  const stepNumber = Number(rawStep);

  if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 4) {
    notFound();
  }

  const step = stepNumber as WizardStep;

  return <ReceiveWizard initialStep={step} receiverName={session.name} draftScope={`${session.storeId}:${session.userId}`} />;
}
