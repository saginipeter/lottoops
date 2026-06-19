import { ComingSoon } from "@/components/layout/coming-soon";
import { Gamepad2 } from "lucide-react";

export default function GamesPage() {
  return (
    <ComingSoon
      title="Games"
      subtitle="Add, edit, and manage scratch-off games"
      icon={Gamepad2}
      description="Add Texas Lottery game numbers, names, prices, and pack sizes. Games appear in the Receive Inventory form and on the TV display board."
    />
  );
}
