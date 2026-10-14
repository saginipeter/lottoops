import { prisma } from "@/lib/prisma";

interface OwnerReader {
  user: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; name: true; email: true };
    }): Promise<Array<{ id: string; name: string; email: string }>>;
  };
}

export async function getPlatformStoreOwners(ownerUserIds: Array<string | null>, db: OwnerReader = prisma) {
  const ids = Array.from(new Set(ownerUserIds.filter((id): id is string => id !== null)));
  if (!ids.length) return new Map<string, { name: string; email: string }>();
  const owners = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  return new Map(owners.map((owner) => [owner.id, { name: owner.name, email: owner.email }]));
}
