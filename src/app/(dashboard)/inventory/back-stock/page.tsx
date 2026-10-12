import { redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { BackStockBrowser } from "@/components/inventory/back-stock-browser";
import { getSession } from "@/lib/get-session";
import { canManageBackstock } from "@/lib/permissions";
import { getDisplaySlots } from "@/lib/services/display-slots";

export default async function BackStockPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageBackstock(session)) redirect("/");

  const displaySlots = await getDisplaySlots(session.storeId);
  const slots = displaySlots.map((slot: { id: string; slotNumber: string; packId: string | null }) => ({
    id: slot.id,
    slotNumber: slot.slotNumber,
    occupied: Boolean(slot.packId),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title="Back Stock"
        subtitle="Received packs awaiting activation"
        actions={
          <Link href="/inventory/active">
            <Button variant="secondary">Active Stock</Button>
          </Link>
        }
      />
      <BackStockBrowser
        slots={slots}
        canManageBackstock={canManageBackstock(session)}
      />
    </div>
  );
}
