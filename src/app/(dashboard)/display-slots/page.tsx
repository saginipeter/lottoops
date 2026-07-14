import { Header } from "@/components/layout/header";
import DisplaySlotGrid from "@/components/display-slots/display-slot-grid";
import { getDisplaySlots } from "@/lib/services/display-slots";
import { getSession } from "@/lib/get-session";

export default async function DisplaySlotsPage() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Display Slots" subtitle="Not authenticated" />
        <div className="flex-1 overflow-y-auto px-4 py-3.5">
          <div className="rounded-lg border-2 border-dashed border-red-300 bg-red-50 p-6 text-center">
            <p className="text-red-600 font-medium">Not authenticated</p>
          </div>
        </div>
      </div>
    );
  }

  const slots = await getDisplaySlots(session.storeId);

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