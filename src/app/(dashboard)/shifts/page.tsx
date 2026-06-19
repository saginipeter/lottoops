import { ComingSoon } from "@/components/layout/coming-soon";
import { Clock } from "lucide-react";

export default function ShiftsPage() {
  return (
    <ComingSoon
      title="Shifts"
      subtitle="Open and close shifts, reconcile ticket sales"
      icon={Clock}
      description="Open a shift to pull beginning ticket numbers, then close it out to calculate tickets sold and sales for every active display."
    />
  );
}
