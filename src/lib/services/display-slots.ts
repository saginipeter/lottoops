import { prisma } from "@/lib/prisma";

export const DISPLAY_SLOT_COUNT = 50;

export async function ensureDisplaySlots(storeId: string) {
  if (!prisma) return;

  const existingSlots = await prisma.displaySlot.findMany({
    where: { storeId },
    select: { slotNumber: true },
  });
  const existingNumbers = new Set(existingSlots.map((slot) => slot.slotNumber));
  const missingSlots = Array.from({ length: DISPLAY_SLOT_COUNT }, (_, index) =>
    String(index + 1).padStart(2, "0")
  )
    .filter((slotNumber) => !existingNumbers.has(slotNumber))
    .map((slotNumber) => ({ storeId, slotNumber }));

  if (missingSlots.length > 0) {
    await prisma.displaySlot.createMany({ data: missingSlots, skipDuplicates: true });
  }
}

export async function getDisplaySlots(storeId: string) {
  if (!prisma) {
    return [];
  }

  await ensureDisplaySlots(storeId);

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