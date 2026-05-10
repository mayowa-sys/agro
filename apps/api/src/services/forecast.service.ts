import axios from 'axios';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const aiHttp = axios.create({
  baseURL: process.env.AI_SERVICE_URL ?? 'http://localhost:8001',
  headers: { Authorization: `Bearer ${process.env.AI_SERVICE_TOKEN}` },
});

export async function runForecast(farmerId: string) {
  const cacheKey = `forecast:${farmerId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const farmer = await prisma.farmer.findUniqueOrThrow({
    where: { id: farmerId },
    include: {
      virtualAccounts: {
        include: {
          transactions: { orderBy: { occurredAt: 'desc' }, take: 100 },
        },
      },
    },
  });

  const transactionHistory = farmer.virtualAccounts
    .flatMap(va => va.transactions)
    .map(t => ({
      date: t.occurredAt.toISOString(),
      amount: Number(t.amount),
      type: t.type,
    }));

  const { data } = await aiHttp.post('/forecast', {
    farmer_id: farmerId,
    crop_type: farmer.cropType,
    region: farmer.region,
    planting_date: farmer.plantingDate?.toISOString() ?? null,
    expected_harvest_date: farmer.expectedHarvestDate?.toISOString() ?? null,
    transaction_history: transactionHistory,
    horizon_days: 180,
  });

  const forecast = await prisma.forecast.create({
    data: {
      farmerId,
      modelVersion: data.model_version ?? 'v1',
      horizonDays: 180,
      events: {
        create: data.events.map((e: any) => ({
          expectedDate: new Date(e.date),
          expectedAmount: BigInt(e.amount),
          type: e.type,
          category: e.category,
          confidence: e.confidence,
          reasonsJson: e.reasons,
        })),
      },
    },
    include: { events: true },
  });

  // Detect and persist cash gaps
  for (const gap of data.cash_gaps ?? []) {
    await prisma.cashGap.create({
      data: {
        farmerId,
        startDate: new Date(gap.start_date),
        endDate: new Date(gap.end_date),
        gapAmount: BigInt(gap.gap_amount_kobo ?? 0),
        status: 'ACTIVE',
      },
    });
  }

  await redis.set(cacheKey, JSON.stringify(forecast), 'EX', 3600);
  return forecast;
}

export async function runStressTest(farmerId: string, scenario: string) {
  const farmer = await prisma.farmer.findUniqueOrThrow({ where: { id: farmerId } });
  const { data } = await aiHttp.post('/forecast/stress-test', {
    crop_type: farmer.cropType,
    scenario,
    transaction_history: [],
  });
  return data;
}

export async function suggestSplit(farmerId: string) {
  const farmer = await prisma.farmer.findUniqueOrThrow({
    where: { id: farmerId },
    include: {
      splitRule: true,
      forecasts: {
        orderBy: { generatedAt: 'desc' },
        take: 1,
        include: { events: true },
      },
    },
  });

  const forecast = farmer.forecasts[0] ?? null;
  const forecastPayload = forecast
    ? {
        events: forecast.events.map(e => ({
          date: e.expectedDate.toISOString(),
          amount: Number(e.expectedAmount),
          type: e.type,
          category: e.category,
        })),
      }
    : null;

  const { data } = await aiHttp.post('/split/suggest', {
    farmer_id: farmerId,
    forecast: forecastPayload,
    current_split: farmer.splitRule,
  });
  return data;
}
