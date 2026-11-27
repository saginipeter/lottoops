import { redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { BackStockBrowser } from "@/components/inventory/back-stock-browser";
import { getSession } from "@/lib/get-session";
import { canManageBackstock } from "@/lib/permissions";
import { InlineGuidance } from "@/components/ui/inline-guidance";

export default async function BackStockPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageBackstock(session)) redirect("/");

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
      <main className="px-4 pt-4 sm:px-6">
        <InlineGuidance title="Back Stock">
          Find a pack by game, pack number, or invoice. Activate it only when it is ready for tracking, then assign it to an open display slot.
        </InlineGuidance>
      </main>
      <BackStockBrowser
        canManageBackstock={canManageBackstock(session)}
      />
    </div>
  );
}
