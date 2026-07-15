const { PrismaClient } = require('./src/generated/prisma/index.js');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SHIFT_LEAD'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EMPLOYEE'`);
  const r1 = await prisma.$executeRawUnsafe(`UPDATE users SET role = 'SHIFT_LEAD' WHERE role = 'CLERK'`);
  const r2 = await prisma.$executeRawUnsafe(`UPDATE users SET role = 'EMPLOYEE' WHERE role = 'VIEWER'`);
  console.log("Migrated: " + r1 + " CLERK->SHIFT_LEAD, " + r2 + " VIEWER->EMPLOYEE");
}

main().then(() => { console.log("Done"); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); });