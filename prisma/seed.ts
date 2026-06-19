import { PrismaClient, Role, PackStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.create({
    data: { name: "Sunrise Mart #4" },
  });

  // One user per role, per the Week 2 role-based access requirement.
  // Passwords are for local dev only — change before any real deployment.
  const passwordHash = await bcrypt.hash("password123", 10);

  const manager = await prisma.user.create({
    data: {
      storeId: store.id,
      email: "manager@lottoops.test",
      passwordHash,
      name: "Maria Alvarez",
      role: Role.MANAGER,
    },
  });

  const clerk = await prisma.user.create({
    data: {
      storeId: store.id,
      email: "clerk@lottoops.test",
      passwordHash,
      name: "Jordan Kim",
      role: Role.CLERK,
    },
  });

  await prisma.user.create({
    data: {
      storeId: store.id,
      email: "viewer@lottoops.test",
      passwordHash,
      name: "Casey Torres",
      role: Role.VIEWER,
    },
  });

  // Real, current Texas Lottery scratch-off games (texaslottery.com).
  const gameData = [
    { gameNumber: "2739", name: "King of Cash", price: 2, ticketsPerPack: 150 },
    { gameNumber: "2727", name: "All About the 8s", price: 5, ticketsPerPack: 75 },
    { gameNumber: "2733", name: "Mega Cash!", price: 10, ticketsPerPack: 40 },
    { gameNumber: "2613", name: "200X The Cash", price: 20, ticketsPerPack: 30 },
    { gameNumber: "2730", name: "Millionaire's Club", price: 30, ticketsPerPack: 20 },
    { gameNumber: "2711", name: "30X The Cash Word Search", price: 3, ticketsPerPack: 125 },
  ];

  const games = await Promise.all(
    gameData.map((g) =>
      prisma.game.create({
        data: { ...g, storeId: store.id },
      })
    )
  );

  const [g1, g2, g3, g4, g5, g6] = games;

  // A handful of back-stock and active packs, mirroring the old mock data
  // so the UI looks the same once it's wired to real queries.
  await prisma.pack.create({
    data: {
      storeId: store.id,
      gameId: g1.id,
      serialNumber: "2739-0334219",
      status: PackStatus.BACK_STOCK,
      cost: 240,
      retailValue: 300,
      receivedById: manager.id,
    },
  });

  await prisma.pack.create({
    data: {
      storeId: store.id,
      gameId: g3.id,
      serialNumber: "2733-0091873",
      status: PackStatus.BACK_STOCK,
      cost: 320,
      retailValue: 400,
      receivedById: manager.id,
    },
  });

  const activePack = await prisma.pack.create({
    data: {
      storeId: store.id,
      gameId: g6.id,
      serialNumber: "2711-1129944",
      status: PackStatus.ACTIVE,
      cost: 300,
      retailValue: 375,
      receivedById: clerk.id,
      currentTicketNumber: 88,
      activatedAt: new Date(),
    },
  });

  await prisma.displaySlot.create({
    data: {
      storeId: store.id,
      slotNumber: "03",
      packId: activePack.id,
    },
  });

  // Empty slots for the rest of the board.
  for (const n of ["01", "02", "04", "05", "06", "07", "08", "09", "10"]) {
    await prisma.displaySlot.create({
      data: { storeId: store.id, slotNumber: n },
    });
  }

  console.log("Seed complete:");
  console.log("  Store:", store.name);
  console.log("  Users: manager@lottoops.test / clerk@lottoops.test / viewer@lottoops.test");
  console.log("  Password for all seeded users: password123");
  console.log("  Games:", games.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
