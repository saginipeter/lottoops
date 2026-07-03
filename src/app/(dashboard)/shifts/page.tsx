import { Header } from "@/components/layout/header";
import ShiftDashboard from "@/components/shifts/shift-dashboard";
import { prisma } from "@/lib/prisma";

export default async function ShiftsPage() {
  const openShift = await prisma.shift.findFirst({
    where: {
      status: "OPEN",
    },
    include: {
      lines: {
        include: {
          pack: {
            include: {
              game: true,
            },
          },
        },
      },
    },
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Shift Management"
        subtitle="Open and close daily shifts"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <ShiftDashboard shift={openShift} />
      </div>
    </div>
  );
}