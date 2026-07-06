"use client";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface PackActionsProps {
  pack: any;
}

export function PackActions({
  pack,
}: PackActionsProps) {
  return (
    <Panel className="space-y-4 p-6">
      <Button className="w-full">
        Update Current Ticket
      </Button>

      <Button
        variant="secondary"
        className="w-full"
      >
        Move Slot
      </Button>

      <Button
        variant="destructive"
        className="w-full"
      >
        Mark Sold Out
      </Button>
    </Panel>
  );
}