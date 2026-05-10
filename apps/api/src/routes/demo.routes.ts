import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { runForecast } from '../services/forecast.service';
import { wagesQueue } from '../lib/queues';

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
    await prisma.matchFeedback.deleteMany({});
    await prisma.wageTransfer.deleteMany({});
    await prisma.rating.deleteMany({});
    await prisma.gig.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.labourer.deleteMany({});

    // Ensure accounts exist (may have been wiped by DB reset)
    const existingAccounts = await prisma.virtualAccount.findMany({
      where: { farmerId: TUNDE_FARMER_ID },
    });
    if (existingAccounts.length === 0) {
      const purposes = ['WORKING', 'BILLS', 'NEXT_SEASON'] as const;
      for (const purpose of purposes) {
        await prisma.virtualAccount.create({
          data: {
            farmerId: TUNDE_FARMER_ID,
            squadAccountNumber: `010${Math.floor(Math.random() * 9000000) + 1000000}`,
            squadCustomerId: `mock-cust-${purpose}-${Date.now()}`,
            bankName: 'GTBank',
            purpose,
          },
        });
      }
    }

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

    // --- Seed labourers for v4 demo ---

    // 1. Create/update Adamu user + labourer profile
    const adamuUser = await prisma.user.upsert({
      where: { phone: '08055555555' },
      update: { role: 'LABOURER' },
      create: { phone: '08055555555', role: 'LABOURER', language: 'EN' },
    });

    const adamu = await prisma.labourer.upsert({
      where: { userId: adamuUser.id },
      update: {
        fullName: 'Adamu Bello',
        region: 'Benue',
        state: 'Benue State',
        latitude: 7.7325,
        longitude: 8.5391,
        skills: ['harvest', 'weeding'],
        spokenLanguages: ['HAUSA', 'PIDGIN'],
      },
      create: {
        userId: adamuUser.id,
        fullName: 'Adamu Bello',
        region: 'Benue',
        state: 'Benue State',
        latitude: 7.7325,
        longitude: 8.5391,
        skills: ['harvest', 'weeding'],
        spokenLanguages: ['HAUSA', 'PIDGIN'],
      },
    });

    // Ensure Adamu has a LABOUR_SAVINGS VA
    const adamuVA = await prisma.virtualAccount.findFirst({
      where: { userId: adamuUser.id, purpose: 'LABOUR_SAVINGS' },
    });
    if (!adamuVA) {
      await prisma.virtualAccount.create({
        data: {
          userId: adamuUser.id,
          squadAccountNumber: `010${Math.floor(Math.random() * 9000000) + 1000000}`,
          squadCustomerId: `mock-adamu-${Date.now()}`,
          bankName: 'GTBank',
          purpose: 'LABOUR_SAVINGS',
        },
      });
    }

    // Seed 8 historic completed gigs for Adamu with 4.4 avg rating → Tier 2
    const tundeFarmer = await prisma.farmer.findUnique({ where: { id: TUNDE_FARMER_ID } });
    if (tundeFarmer) {
      // Create a historical job
      const pastJob = await prisma.job.create({
        data: {
          farmerId: TUNDE_FARMER_ID,
          title: 'Past yam harvest (historic)',
          skillsRequired: ['harvest'],
          expectedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          durationDays: 2,
          payAmountKobo: 3500000n,
          workersNeeded: 1,
          status: 'FILLED',
        },
      });

      // Create 8 historic paid gigs with ratings
      const ratings = [5, 5, 4, 5, 4, 4, 5, 4]; // avg 4.5 → rounds to 4.4?
      for (let i = 0; i < 8; i++) {
        const pastGig = await prisma.gig.create({
          data: {
            jobId: pastJob.id,
            labourerId: adamu.id,
            agreedAmountKobo: 3500000n,
            status: 'PAID',
            acceptedAt: new Date(Date.now() - (30 + i) * 24 * 60 * 60 * 1000),
            farmerConfirmedAt: new Date(Date.now() - (29 + i) * 24 * 60 * 60 * 1000),
            labourerConfirmedAt: new Date(Date.now() - (29 + i) * 24 * 60 * 60 * 1000),
            paidAt: new Date(Date.now() - (28 + i) * 24 * 60 * 60 * 1000),
          },
        });
        await prisma.rating.create({
          data: {
            gigId: pastGig.id,
            labourerId: adamu.id,
            farmerScoreOfLabourer: ratings[i],
          },
        });
      }

      // Update Adamu's stats
      await prisma.labourer.update({
        where: { id: adamu.id },
        data: {
          totalGigsCompleted: 8,
          totalEarnedKobo: 28000000n, // 8 × ₦35,000
          reputationTier: 2,
        },
      });
    }

    // 2. Create 2 additional labourers (different skills/distances)
    const extraLabourers = [
      {
        phone: '08066666666',
        name: 'Chidinma Okonkwo',
        region: 'Enugu',
        skills: ['planting', 'land-prep'],
        languages: ['IGBO', 'EN'],
        lat: 6.5244, lng: 7.5090,
      },
      {
        phone: '08077777777',
        name: 'Musa Ibrahim',
        region: 'Kaduna',
        skills: ['pesticide-application', 'harvest'],
        languages: ['HAUSA', 'EN'],
        lat: 10.5105, lng: 7.4165,
      },
    ];

    for (const el of extraLabourers) {
      const user = await prisma.user.upsert({
        where: { phone: el.phone },
        update: { role: 'LABOURER' },
        create: { phone: el.phone, role: 'LABOURER', language: 'EN' },
      });
      await prisma.labourer.upsert({
        where: { userId: user.id },
        update: {
          fullName: el.name,
          region: el.region,
          state: el.region,
          latitude: el.lat,
          longitude: el.lng,
          skills: el.skills,
          spokenLanguages: el.languages,
        },
        create: {
          userId: user.id,
          fullName: el.name,
          region: el.region,
          state: el.region,
          latitude: el.lat,
          longitude: el.lng,
          skills: el.skills,
          spokenLanguages: el.languages,
        },
      });
    }

    // 3. Create 1 OPEN job from Tunde for demo
    const openJob = await prisma.job.create({
      data: {
        farmerId: TUNDE_FARMER_ID,
        title: 'Cassava harvest help needed',
        description: 'Looking for 2 labourers to help with cassava harvest. Tools provided.',
        skillsRequired: ['harvest', 'weeding'],
        expectedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        durationDays: 3,
        payAmountKobo: 3500000n,
        workersNeeded: 2,
        status: 'OPEN',
      },
    });

    // 3b. Create a pre-accepted gig for demo wage flow (no live login switching needed)
    const acceptedJob = await prisma.job.create({
      data: {
        farmerId: TUNDE_FARMER_ID,
        title: 'Weeding help (pre-accepted for demo)',
        skillsRequired: ['weeding'],
        expectedDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        durationDays: 1,
        payAmountKobo: 1500000n,
        workersNeeded: 1,
        status: 'FILLED',
      },
    });

    await prisma.gig.create({
      data: {
        jobId: acceptedJob.id,
        labourerId: adamu.id,
        agreedAmountKobo: 1500000n,
        status: 'ACCEPTED',
      },
    });

    // 4. Pre-compute embeddings synchronously
    try {
      const aiToken = process.env.AI_SERVICE_TOKEN || '919df173af79fdb0a783fdca12fdaf6fb3d3906c4fca7709cdae8f31287e94f8';
      const aiBase = process.env.AI_SERVICE_URL || 'http://localhost:8001';

      // Embed Adamu
      const adamuEmbRes = await fetch(`${aiBase}/embeddings/labourer`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${aiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Adamu Bello', region: 'Benue', skills: ['harvest', 'weeding'], spokenLanguages: ['HAUSA', 'PIDGIN'] }),
      });
      if (adamuEmbRes.ok) {
        const adamuEmb = await adamuEmbRes.json();
        await prisma.labourer.update({
          where: { id: adamu.id },
          data: { profileEmbedding: adamuEmb.embedding, profileEmbeddingUpdatedAt: new Date() },
        });
      }

      // Embed open job
      const jobEmbRes = await fetch(`${aiBase}/embeddings/job`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${aiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Cassava harvest help needed', description: 'Looking for 2 labourers', skillsRequired: ['harvest', 'weeding'], region: 'Benue', durationDays: 3 }),
      });
      if (jobEmbRes.ok) {
        const jobEmb = await jobEmbRes.json();
        await prisma.job.update({
          where: { id: openJob.id },
          data: { descriptionEmbedding: jobEmb.embedding, descriptionEmbeddingUpdatedAt: new Date() },
        });
      }
    } catch (embErr) {
      console.warn('Embedding pre-compute failed (non-fatal):', embErr);
    }

    res.json({
      ok: true,
      message: 'Tunde + labourers reset and re-seeded successfully',
      demoIdentities: {
        farmer: { name: 'Tunde Adeyemi', phone: '08012345678' },
        labourer: { name: 'Adamu Bello', phone: '08055555555' },
        aggregator: { name: 'Agbo Foods', phone: '08099999999' },
      },
    });

  } catch (err) {
    console.error('SEED ERROR:', err);
    next(err);
  }
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

// POST /demo/simulate-wage-completion
demoRouter.post('/simulate-wage-completion', async (req: Request, res: Response, next) => {
  if (!checkDemoAuth(req, res)) return;
  try {
    const adamu = await prisma.labourer.findFirst({
      where: { user: { phone: '08055555555' } },
    });
    if (!adamu) throw new AppError(404, 'Demo labourer Adamu not found — run seed-tunde first');

    const gig = await prisma.gig.findFirst({
      where: { labourerId: adamu.id, status: 'ACCEPTED' },
      orderBy: { acceptedAt: 'desc' },
    });
    if (!gig) throw new AppError(404, 'No ACCEPTED gig found for Adamu');

    await prisma.gig.update({
      where: { id: gig.id },
      data: {
        farmerConfirmedAt: new Date(),
        labourerConfirmedAt: new Date(),
        status: 'BOTH_CONFIRMED',
      },
    });

    await wagesQueue.add('route-wage', { gigId: gig.id });

    res.json({ ok: true, gigId: gig.id, message: 'Both sides confirmed. Wage routing enqueued.' });
  } catch (err) { next(err); }
});