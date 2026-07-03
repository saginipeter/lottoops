import { Header } from "@/components/layout/header";
import DisplaySlotGrid from "@/components/display-slots/display-slot-grid";
import { getDisplaySlots } from "@/lib/services/display-slots";

export default async function DisplaySlotsPage() {

  const slots = await getDisplaySlots();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">

      <Header
        title="Display Slots"
        subtitle={`${slots.length} display slots`}
      />

      <div className="flex-1 overflow-y-auto px-4 py-3.5">

        <DisplaySlotGrid
          slots={slots}
        />

      </div>

    </div>
  );
}