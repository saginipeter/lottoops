import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title="Receive Packs"
        subtitle={`Shipment receiving · Step ${step} of 4`}
      />
      <ReceiveWizard initialStep={step} />
    </div>
  );
}