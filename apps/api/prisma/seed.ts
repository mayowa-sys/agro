import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding...');

  const playbooks = [
    { name: 'Yam Cycle', cropType: 'YAM' as const, description: 'Single annual harvest Nov–Jan. High input costs at planting (Feb–Mar). Peak income ₦180–230k.', baselineSeasonality: { peakMonths: [11, 12, 1], troughMonths: [5, 6], avgHarvestKobo: 20500000 } },
    { name: 'Tomato Glut', cropType: 'TOMATO' as const, description: 'Multiple harvest windows every ~6 weeks. Vulnerable to price crashes and rot losses.', baselineSeasonality: { peakMonths: [2, 4, 6, 8, 10], troughMonths: [1, 7], avgHarvestKobo: 6000000 } },
    { name: 'Cocoa Lag', cropType: 'COCOA' as const, description: 'Two main seasons — light crop (Apr–Jun) and main crop (Oct–Dec). Long payment lag from buyers.', baselineSeasonality: { peakMonths: [5, 11], troughMonths: [2, 8], avgHarvestKobo: 22500000 } },
    { name: 'Maize Sprint', cropType: 'MAIZE' as const, description: 'Short 90-day cycle. Single harvest spike month 5. Input-heavy at start.', baselineSeasonality: { peakMonths: [5], troughMonths: [2, 8], avgHarvestKobo: 12500000 } },
    { name: 'Cassava Steady', cropType: 'CASSAVA' as const, description: 'Slow-maturing 9–12 months. Two partial harvests. Stable but low unit prices.', baselineSeasonality: { peakMonths: [6, 11], troughMonths: [3, 9], avgHarvestKobo: 10000000 } },
    { name: 'Rice Surge', cropType: 'RICE' as const, description: 'Single harvest spike month 8. High milling and transport costs post-harvest.', baselineSeasonality: { peakMonths: [8], troughMonths: [4, 11], avgHarvestKobo: 15500000 } },
  ];

  for (const p of playbooks) {
    await prisma.cropPlaybook.upsert({ where: { name: p.name }, update: {}, create: p });
  }
  console.log('OK: 6 CropPlaybooks seeded');

  const suppliers = [
    { id: 'supplier-lagos',   name: 'Lagos Fertilizer Co.',  contactPhone: '08011111111', squadAccountNumber: '0100000001', region: 'Lagos' },
    { id: 'supplier-kano',    name: 'Kano Agro Inputs Ltd',  contactPhone: '08022222222', squadAccountNumber: '0100000002', region: 'Kano' },
    { id: 'supplier-ibadan',  name: 'Ibadan Farm Supplies',  contactPhone: '08033333333', squadAccountNumber: '0100000003', region: 'Ibadan' },
    { id: 'supplier-onitsha', name: 'Onitsha Seed House',    contactPhone: '08044444444', squadAccountNumber: '0100000004', region: 'Onitsha' },
    { id: 'supplier-kaduna',  name: 'Kaduna AgriChem',       contactPhone: '08055555555', squadAccountNumber: '0100000005', region: 'Kaduna' },
  ];

  for (const s of suppliers) {
    await prisma.supplier.upsert({ where: { id: s.id }, update: {}, create: s });
  }
  console.log('OK: 5 Suppliers seeded');

  const aggUser = await prisma.user.upsert({
    where: { phone: '08099999999' },
    update: {},
    create: { phone: '08099999999', role: 'AGGREGATOR', language: 'EN' },
  });
  await prisma.aggregator.upsert({
    where: { userId: aggUser.id },
    update: {},
    create: { userId: aggUser.id, businessName: 'Agbo Foods Processor', contactEmail: 'agbo@demo.agro' },
  });
  console.log('OK: Demo Aggregator seeded');

  const tundeUser = await prisma.user.upsert({
    where: { phone: '08012345678' },
    update: {},
    create: { phone: '08012345678', role: 'FARMER', language: 'EN' },
  });
  await prisma.farmer.upsert({
    where: { userId: tundeUser.id },
    update: {},
    create: {
      userId: tundeUser.id,
      name: 'Tunde Adeyemi',
      cropType: 'YAM',
      region: 'Benue',
      zone: 'North Central',
      plantingDate: new Date('2025-02-01'),
      expectedHarvestDate: new Date('2025-11-15'),
    },
  });
  console.log('OK: Demo Farmer Tunde seeded');

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error('DANGER:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
