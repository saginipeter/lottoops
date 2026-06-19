import { ComingSoon } from "@/components/layout/coming-soon";
import { MonitorPlay } from "lucide-react";

export default function SlotsPage() {
  return (
    <ComingSoon
      title="Display Slots"
      subtitle="Activate back stock packs to the TV display board"
      icon={MonitorPlay}
      description="Pick an empty or sold-out slot, choose a back stock pack, enter the starting ticket number, and put it on the board."
    />
  );
}
