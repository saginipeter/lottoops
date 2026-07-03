import { prisma } from "@/lib/prisma";

export async function getCurrentShift() {
  return prisma.shift.findFirst({
    where: {
      status: "OPEN",
    },

    include: {
      openedBy: true,

      lines: {
        include: {
          pack: {
            include: {
              game: true,
            },
          },
        },
      },
    },

    orderBy: {
      openedAt: "desc",
    },
  });
}