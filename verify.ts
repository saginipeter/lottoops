import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Querying database...');

  // 1. ACTIVE packs count
  const activePacks = await prisma.pack.count({
    where: { status: 'ACTIVE' }
  });

  // 2. BACK_STOCK packs count
  const backStockPacks = await prisma.pack.count({
    where: { status: 'BACK_STOCK' }
  });

  // 3. Occupied display slots
  // From schema: display_slots model has packId String? @unique. If packId is present, it's occupied.
  const occupiedSlots = await prisma.displaySlot.count({
    where: { NOT: { packId: null } }
  });

  // 4. Shift lines linked to ACTIVE/BACK_STOCK packs
  const shiftLines = await prisma.shiftLine.count({
    where: {
      pack: {
        status: { in: ['ACTIVE', 'BACK_STOCK'] }
      }
    }
  });

  // 5. Inventory audit lines linked to ACTIVE/BACK_STOCK packs
  const auditLines = await prisma.inventoryAuditLine.count({
    where: {
      pack: {
        status: { in: ['ACTIVE', 'BACK_STOCK'] }
      }
    }
  });

  // 6. Inventory activity log rows if the table exists (we don't see one in schema, but there's "ScanLogEntry" or similar. Let's see if other tables exist. We can query the information_schema).
  // Let's list table names or count rows in ScanLogEntry if that is what they mean, or check if there is an "InventoryActivityLog" or similar table in pg.
  let activityLogRows: any = 'N/A';
  try {
    // Run raw query to check if table exists
    const tables: any[] = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    const tableNames = tables.map((t: any) => t.table_name);
    console.log('Tables found in database:', tableNames);

    // Let's filter for potential inventory activity log tables
    const potentialActivityLogTable = tableNames.find((name: string) => 
      name.toLowerCase().includes('activity') || 
      name.toLowerCase().includes('log')
    );

    if (potentialActivityLogTable) {
      console.log(`Potential activity log table found: ${potentialActivityLogTable}`);
      const countResult: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "${potentialActivityLogTable}"`);
      activityLogRows = countResult[0].count;
    } else {
      activityLogRows = 'No matching activity log table found';
    }
  } catch (err: any) {
    console.error('Error fetching activity log rows or tables:', err.message);
  }

  console.log('\n--- VERIFICATION RESULTS ---');
  console.log(`ACTIVE Packs: ${activePacks}`);
  console.log(`BACK_STOCK Packs: ${backStockPacks}`);
  console.log(`Occupied Display Slots: ${occupiedSlots}`);
  console.log(`Shift Lines linked to ACTIVE/BACK_STOCK packs: ${shiftLines}`);
  console.log(`Inventory Audit Lines linked to ACTIVE/BACK_STOCK packs: ${auditLines}`);
  console.log(`Inventory Activity Log rows: ${activityLogRows}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
