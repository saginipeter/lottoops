import { prisma } from "@/lib/prisma";


export async function getDisplaySlots(storeId: string) {
  if (!prisma) {
    return [];
  }

  const slots = await prisma.displaySlot.findMany({
    where: {
      storeId,
    },
    include: {
      pack: {
        include: {
          game: true,
        },
      },
    },
    orderBy: {
      slotNumber: "asc",
    },
  });

  return slots.map((slot: any) => ({
    ...slot,
    pack: slot.pack
      ? {
          ...slot.pack,
          cost: Number(slot.pack.cost),
          retailValue: Number(slot.pack.retailValue),
          ticketPrice: slot.pack.ticketPrice
            ? Number(slot.pack.ticketPrice)
            : null,
          game: {
            ...slot.pack.game,
            price: Number(slot.pack.game.price),
          },
        }
      : null,
  }));
}