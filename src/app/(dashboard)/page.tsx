import { getSession } from "@/lib/get-session";
import { PosHomeDashboard } from "@/components/home/pos-home-dashboard";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const session = await getSession();
  const tvStores = session?.role === "OWNER" && prisma ? await prisma.store.findMany({
    where: { OR: [
      { ownerUserId: session.userId },
      { users: { some: { id: session.userId, role: "OWNER", active: true } } },
    ] },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  }) : [];

  return (
    <PosHomeDashboard
      storeName={session?.storeName ?? "LottoOps Store"}
      storeId={session?.storeId}
      tvStores={tvStores}
      role={session?.role ?? "EMPLOYEE"}
      grantedPermissions={session?.grantedPermissions ?? []}
    />
  );
}
