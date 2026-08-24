import { prisma } from "@/lib/prisma";

export const DISPLAY_SLOT_COUNT = 50;

export async function ensureDisplaySlots(storeId: string) {
  if (!prisma) return;

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE packs
      ADD COLUMN IF NOT EXISTS "sequenceLocked" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "sequenceLockExpectedTicket" INTEGER,
      ADD COLUMN IF NOT EXISTS "sequenceLockScannedTicket" INTEGER,
      ADD COLUMN IF NOT EXISTS "sequenceLockBarcode" TEXT,
      ADD COLUMN IF NOT EXISTS "sequenceLockedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "sequenceLockedById" TEXT
    `);

    const existingSlots = (await prisma.displaySlot.findMany({
      where: { storeId },
      select: { slotNumber: true },
    })) as Array<{ slotNumber: string }>;
    const existingNumbers = new Set(existingSlots.map((slot: { slotNumber: string }) => slot.slotNumber));
    const missingSlots = Array.from({ length: DISPLAY_SLOT_COUNT }, (_, index) =>
      String(index + 1).padStart(2, "0")
    )
      .filter((slotNumber) => !existingNumbers.has(slotNumber))
      .map((slotNumber) => ({ storeId, slotNumber }));

    if (missingSlots.length > 0) {
      await prisma.displaySlot.createMany({ data: missingSlots, skipDuplicates: true });
    }
  } catch (error) {
    console.error("Unable to provision display slots:", error);
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