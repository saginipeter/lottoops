import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { ReturnedTicketsList } from "@/components/inventory/returned-tickets-list";
import { Button } from "@/components/ui/button";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Returned Tickets</h1>
        <p className="mt-1 text-sm text-gray-600">
          Packs removed from display/back stock are tracked here and marked inactive.
        </p>
        <div className="mt-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory">Back to Back Stock</Link>
          </Button>
        </div>
      </div>
      <ReturnedTicketsList packs={packs} />
    </div>
  );
}
