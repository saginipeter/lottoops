"use client";

import OpenShiftCard from "./open-shift-card";
import CloseShiftCard from "./close-shift-card";

interface ShiftDashboardProps {
  shift: any;
}

export default function ShiftDashboard({
  shift,
}: ShiftDashboardProps) {
  if (!shift) {
    return (
      <OpenShiftCard />
    );
  }

  return (
    <CloseShiftCard
      shift={shift}
    />
  );
}