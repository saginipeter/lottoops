import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { ReturnedTicketsList } from "@/components/inventory/returned-tickets-list";
import { Button } from "@/components/ui/button";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";

export default async function ReturnedTicketsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const packs = await prisma.pack.findMany({
    where: {
      storeId: session.storeId,
      status: "RETURNED",
    },
    orderBy: [{ activeRemovalReasonAt: "desc" }, { removalReasonAt: "desc" }],
    include: {
      game: { select: { name: true } },
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title="Returned Tickets"
        subtitle="Removed packs from display and back stock"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory">Back to Back Stock</Link>
          </Button>
        }
      />

      <PageToolbar
        left={<span className="text-xs text-text-secondary">Compliance and exception tracking</span>}
        center={<span>Ctrl+F Search | Ctrl+P Print</span>}
        right={<span className="text-xs text-text-tertiary">Returned Packs: {packs.length}</span>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <ReturnedTicketsList packs={packs} />
      </div>

      <StatusBar
        left={<span>Total Returned: {packs.length}</span>}
        center={<span>Track removal reasons and audit history</span>}
        right={<span>Store scoped records</span>}
      />
    </div>
  );
}
