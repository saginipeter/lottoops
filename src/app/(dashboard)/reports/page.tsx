import { ComingSoon } from "@/components/layout/coming-soon";
import { FileBarChart } from "lucide-react";

export default function ReportsPage() {
  
  return (
    <ComingSoon
      title="Reports"
      subtitle="Daily summaries, scan logs, and activity history"
      icon={FileBarChart}
      description="Track sales and inventory movement across shifts, with a full audit trail of every action taken in the system."
    />
  );
}
