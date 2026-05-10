import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { runForecast } from '../services/forecast.service';

export const demoRouter = Router();

function checkDemoAuth(req: Request, res: Response): boolean {
  const isDevEnv = process.env.NODE_ENV !== 'production';
  const hasToken = req.headers['x-demo-token'] === process.env.DEMO_RESET_TOKEN;
  if (!isDevEnv && !hasToken) {
    res.status(403).json({ error: 'Demo endpoints not available' });
    return false;
  }
  return true;
}

async function getTundeFarmerId(): Promise<string> {
  const tunde = await prisma.farmer.findFirst({
    where: { user: { phone: '08012345678' } },
  });
  if (!tunde) throw new AppError(500, 'Demo farmer Tunde not found — run seed first');
  return tunde.id;
}

// POST /demo/seed-tunde
demoRouter.post('/seed-tunde', async (req: Request, res: Response, next) => {
  if (!checkDemoAuth(req, res)) return;
  try {
    const TUNDE_FARMER_ID = await getTundeFarmerId();

    // Wipe existing state
    await prisma.cashGap.deleteMany({ where: { farmerId: TUNDE_FARMER_ID } });
    await prisma.forecastEvent.deleteMany({ where: { forecast: { farmerId: TUNDE_FARMER_ID } } });
    await prisma.forecast.deleteMany({ where: { farmerId: TUNDE_FARMER_ID } });
    await prisma.liberationLog.deleteMany({ where: { farmerId: TUNDE_FARMER_ID } });
    await prisma.factoringAdvance.deleteMany({ where: { farmerId: TUNDE_FARMER_ID } });
    await prisma.inputDeferral.deleteMany({ where: { farmerId: TUNDE_FARMER_ID } });
    await prisma.transaction.deleteMany({
      where: { virtualAccount: { farmerId: TUNDE_FARMER_ID } },
    });

    const accounts = await prisma.virtualAccount.findMany({
      where: { farmerId: TUNDE_FARMER_ID },
    });

    // Reset cached balances
    await prisma.virtualAccount.updateMany({
      where: { farmerId: TUNDE_FARMER_ID },
      data: { cachedBalance: 0n },
    });

    // Seed 90 days of realistic prior transactions
    const workingAccount = accounts.find(a => a.purpose === 'WORKING');
    if (workingAccount) {
      const now = new Date();
      const seedTransactions = [
        { daysAgo: 85, amount: 4500000n, source: 'EXTERNAL' as const, desc: 'Opening balance transfer' },
        { daysAgo: 70, amount: 2000000n, source: 'EXTERNAL' as const, desc: 'Cassava partial sale' },
        { daysAgo: 55, amount: 1500000n, source: 'EXTERNAL' as const, desc: 'Odd job income' },
        { daysAgo: 40, amount: 8000000n, source: 'HARVEST_PAYMENT' as const, desc: 'Mid-season yam sale' },
        { daysAgo: 20, amount: 3000000n, source: 'EXTERNAL' as const, desc: 'Transport allowance' },
        { daysAgo: 7,  amount: 1200000n, source: 'EXTERNAL' as const, desc: 'Misc income' },
      ];

      for (const t of seedTransactions) {
        const occurredAt = new Date(now.getTime() - t.daysAgo * 24 * 60 * 60 * 1000);
        await prisma.transaction.create({
          data: {
            virtualAccountId: workingAccount.id,
            squadReference: `demo-seed-${t.daysAgo}-${Date.now()}`,
            amount: t.amount,
            type: 'CREDIT',
            source: t.source,
            occurredAt,
            rawWebhookPayload: { seeded: true, description: t.desc },
            processed: true,
          },
        });
      }

      // Update working balance to sum of seeded credits
      const total = seedTransactions.reduce((sum, t) => sum + t.amount, 0n);
      await prisma.virtualAccount.update({
        where: { id: workingAccount.id },
        data: { cachedBalance: total },
      });
    }

    // Pre-create 1 ACTIVE InputDeferral with first supplier
    const supplier = await prisma.supplier.findFirst({ where: { active: true } });
    if (supplier) {
      await prisma.inputDeferral.create({
        data: {
          farmerId: TUNDE_FARMER_ID,
          supplierId: supplier.id,
          amount: 4000000n,
          agroFee: 80000n,
          status: 'ACTIVE',
          squadMandateId: 'mock-mandate-demo-seed',
          disbursedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          expectedRepayBy: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Seed a LiberationLog baseline (~₦12M counterfactual)
    const aggregator = await prisma.aggregator.findFirst();
    if (aggregator) {
      const factoringAdvance = await prisma.factoringAdvance.create({
        data: {
          aggregatorId: aggregator.id,
          farmerId: TUNDE_FARMER_ID,
          amount: 18000000n,
          fee: 540000n,
          status: 'ADVANCED',
          advancedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          expectedRepayBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      await prisma.liberationLog.create({
        data: {
          farmerId: TUNDE_FARMER_ID,
          factoringAdvanceId: factoringAdvance.id,
          counterfactualLossKobo: 1200000000n,
        },
      });
    }

    // Ensure split rule exists
    await prisma.splitRule.upsert({
      where: { farmerId: TUNDE_FARMER_ID },
      update: {},
      create: {
        farmerId: TUNDE_FARMER_ID,
        workingPct: 55,
        billsPct: 25,
        nextSeasonPct: 20,
      },
    });

    // Generate fresh forecast
    await runForecast(TUNDE_FARMER_ID);

    res.json({ ok: true, message: 'Tunde reset and re-seeded successfully' });
  } catch (err) { next(err); }
});

// POST /demo/simulate-payment
demoRouter.post('/simulate-payment', async (req: Request, res: Response, next) => {
  if (!checkDemoAuth(req, res)) return;
  try {
    const { amount, accountNumber, transactionRef } = req.body;
    if (!amount || !accountNumber) {
      return next(new AppError(400, 'amount and accountNumber are required'));
    }

    const ref = transactionRef ?? `demo-${Date.now()}`;
    const payload = {
      Event: 'virtual_account_was_funded',
      Event_Id: ref,
      Body: {
        account_number: accountNumber,
        amount: Number(amount),
        transaction_ref: ref,
        transaction_date: new Date().toISOString(),
      },
    };

    const raw = Buffer.from(JSON.stringify(payload));
    const sig = crypto
      .createHmac('sha512', process.env.SQUAD_WEBHOOK_SECRET!)
      .update(raw)
      .digest('hex');

    const port = process.env.PORT ?? 3000;
    await axios.post(`http://localhost:${port}/squad/webhook`, raw, {
      headers: {
        'Content-Type': 'application/json',
        'x-squad-signature': sig,
      },
    });

    res.json({ ok: true, ref, payload });
  } catch (err) { next(err); }
});

// POST /demo/time-skip
demoRouter.post('/time-skip', async (req: Request, res: Response) => {
  if (!checkDemoAuth(req, res)) return;
  const { days } = req.body;
  res.json({ ok: true, message: `Time-skip of ${days} days acknowledged (client-side only in v1)` });
});

// POST /demo/trigger-stress
demoRouter.post('/trigger-stress', async (req: Request, res: Response, next) => {
  if (!checkDemoAuth(req, res)) return;
  try {
    const { scenario } = req.body;
    if (!scenario) return next(new AppError(400, 'scenario is required'));
    res.json({ ok: true, message: `Stress scenario '${scenario}' triggered — use /forecasts/me/stress-test to retrieve` });
  } catch (err) { next(err); }
});
