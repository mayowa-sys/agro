import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { redis } from '../lib/redis';
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

    // ═══════════════════════════════════════════════════════════════════
    // AUGUST MID-SEASON TIMELINE
    // "Today" is mid-August. Events anchor to real time via sliding window.
    // Story: Tunde planted yam in April. January credit was repaid in March
    // from a small cassava sale. June saw a ₦100k mid-season tomato sale that
    // routed through splits. A May fertilizer credit is still active and will
    // auto-repay from the October harvest.
    // ═══════════════════════════════════════════════════════════════════
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
    const daysAhead = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

    const T_APRIL_PLANT       = daysAgo(120); // April: planting
    const T_JANUARY_CREDIT    = daysAgo(200); // January: input credit disbursed
    const T_MARCH_CASSAVA     = daysAgo(150); // March: small cassava sale repays Jan credit
    const T_MAY_FERTILIZER    = daysAgo(95);  // May: fertilizer credit disbursed (still active)
    const T_JUNE_TOMATO       = daysAgo(60);  // June: mid-season tomato sale fires splits
    const T_OCTOBER_HARVEST   = daysAhead(90); // October: projected main harvest (90d window for visible cash gap)

    // Wipe existing state. Order matters for FK constraints:
    //   wageAdvance → wageTransfer ← gig → rating
    //   liberationLog (FKs gig)
    //   matchFeedback (FKs job/labourer)
    //   then jobs, labourers, credits, factoring
    //   finally: Tunde's transactions + forecasts (so re-seed is fully idempotent)
    await prisma.wageAdvance.deleteMany({});
    await prisma.inputDeferral.deleteMany({ where: { farmerId: TUNDE_FARMER_ID } });
    await prisma.factoringAdvance.deleteMany({ where: { farmerId: TUNDE_FARMER_ID } });
    await prisma.liberationLog.deleteMany({ where: { farmerId: TUNDE_FARMER_ID } });
    await prisma.matchFeedback.deleteMany({});
    await prisma.rating.deleteMany({});
    // Unlink gig→wageTransfer first so we can drop wageTransfers without FK loop
    await prisma.gig.updateMany({ data: { wageTransferId: null } });
    await prisma.wageTransfer.deleteMany({});
    await prisma.gig.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.labourer.deleteMany({});

    // Wipe Tunde's transactions (idempotent re-seed; avoids Prophet drift over runs)
    await prisma.transaction.deleteMany({
      where: { virtualAccount: { farmerId: TUNDE_FARMER_ID } },
    });

    // ── Set Tunde's planting + expected harvest dates ──────────────────
    // CRITICAL: Without these, Prophet skips the fertilizer/weeding/harvest
    // expense spikes in _generate_expense_events, and no real cash gap forms.
    await prisma.farmer.update({
      where: { id: TUNDE_FARMER_ID },
      data: {
        plantingDate: T_APRIL_PLANT,
        expectedHarvestDate: T_OCTOBER_HARVEST,
      },
    });

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

    // Reset cached balances; we'll set end-state directly below
    await prisma.virtualAccount.updateMany({
      where: { farmerId: TUNDE_FARMER_ID },
      data: { cachedBalance: 0n },
    });

    // ── Seed transactions reflecting the mid-season story ──────────────
    // Two harvest events drive the splits + liberation narrative:
    //   - March ₦120k cassava sale (small, repays Jan credit + splits)
    //   - June  ₦100k tomato sale  (clean splits, no credit interaction)
    // Plus smaller income events to fill out a believable transaction history.
    const workingAccount = accounts.find(a => a.purpose === 'WORKING');
    if (workingAccount) {
      const seedTransactions = [
        { occurredAt: daysAgo(180), amount: 2000000n,  type: 'CREDIT' as const,  source: 'EXTERNAL'         as const, desc: 'Opening transfer (pre-season working capital)' },
        { occurredAt: daysAgo(155), amount: 1500000n,  type: 'CREDIT' as const,  source: 'EXTERNAL'         as const, desc: 'Odd job income' },
        { occurredAt: T_MARCH_CASSAVA, amount: 12000000n, type: 'CREDIT' as const, source: 'HARVEST_PAYMENT' as const, desc: 'March cassava sale (mid-cycle)' },
        { occurredAt: daysAgo(140), amount: 4800000n,  type: 'DEBIT'  as const,  source: 'EXTERNAL'         as const, desc: 'January AGRO input credit repaid (principal + 6% fee)' },
        { occurredAt: daysAgo(100), amount: 2500000n,  type: 'CREDIT' as const,  source: 'EXTERNAL'         as const, desc: 'Off-season odd jobs' },
        { occurredAt: daysAgo(80),  amount: 1500000n,  type: 'DEBIT'  as const,  source: 'EXTERNAL'         as const, desc: 'Household + transport' },
        { occurredAt: T_JUNE_TOMATO, amount: 10000000n, type: 'CREDIT' as const, source: 'HARVEST_PAYMENT' as const, desc: 'June tomato sale (mid-season)' },
        { occurredAt: daysAgo(45),  amount: 1800000n,  type: 'DEBIT'  as const,  source: 'EXTERNAL'         as const, desc: 'Household + transport' },
        { occurredAt: daysAgo(30),  amount: 1200000n,  type: 'DEBIT'  as const,  source: 'EXTERNAL'         as const, desc: 'Household + transport' },
        { occurredAt: daysAgo(14),  amount: 800000n,   type: 'DEBIT'  as const,  source: 'EXTERNAL'         as const, desc: 'Household + transport' },
      ];

      let txIdx = 0;
      for (const t of seedTransactions) {
        await prisma.transaction.create({
          data: {
            virtualAccountId: workingAccount.id,
            squadReference: `demo-seed-aug-${txIdx++}-${Date.now()}`,
            amount: t.amount,
            type: t.type,
            source: t.source,
            occurredAt: t.occurredAt,
            rawWebhookPayload: { seeded: true, description: t.desc },
            processed: true,
          },
        });
      }
    }

    // ── Set pot balances directly to the post-burndown end state ───────
    // Working: 55% of March ₦120k (₦66k) + 55% of June ₦100k (₦55k) − Jan
    //   credit repayment (₦84.8k) − household burndown over 5 months
    //   → settles at ₦150k by mid-August.
    // Bills:   25% of March ₦120k (₦30k) + 25% of June ₦100k (₦25k) = ₦55k
    // Next Season: 20% of March (₦24k) + 20% of June (₦20k)        = ₦44k
    const billsAccount      = accounts.find(a => a.purpose === 'BILLS');
    const nextSeasonAccount = accounts.find(a => a.purpose === 'NEXT_SEASON');
    if (workingAccount) {
      await prisma.virtualAccount.update({
        where: { id: workingAccount.id },
        data: { cachedBalance: 15000000n },
      });
    }
    if (billsAccount) {
      await prisma.virtualAccount.update({
        where: { id: billsAccount.id },
        data: { cachedBalance: 5500000n },
      });
    }
    if (nextSeasonAccount) {
      await prisma.virtualAccount.update({
        where: { id: nextSeasonAccount.id },
        data: { cachedBalance: 4400000n },
      });
    }

    // ── Two InputDeferrals: one REPAID (credit history), one DISBURSED (live) ──
    // Worker only auto-repays status=DISBURSED, so the live one must be DISBURSED.
    // Fees use AGRO_INPUT_CREDIT_FEE_PCT = 6% (from .env).
    const supplier = await prisma.supplier.findFirst({ where: { active: true } });
    if (supplier) {
      // REPAID: January ₦80k credit, repaid in March from the cassava sale.
      // This row exists primarily for the credit-score repayment-history factor.
      await prisma.inputDeferral.create({
        data: {
          farmerId: TUNDE_FARMER_ID,
          supplierId: supplier.id,
          amount: 8000000n,                                // ₦80,000 principal
          agroFee: 480000n,                                // ₦4,800 (6% AGRO fee)
          status: 'REPAID',
          squadMandateId: `mock-mandate-jan-${Date.now()}`,
          disbursedAt: T_JANUARY_CREDIT,
          expectedRepayBy: T_OCTOBER_HARVEST,              // originally due at harvest
          repaidAt: T_MARCH_CASSAVA,                       // repaid early from March sale
        },
      });

      // DISBURSED: May fertilizer credit, still live, due at October harvest.
      await prisma.inputDeferral.create({
        data: {
          farmerId: TUNDE_FARMER_ID,
          supplierId: supplier.id,
          amount: 4000000n,                                // ₦40,000 principal
          agroFee: 240000n,                                // ₦2,400 (6% AGRO fee)
          status: 'DISBURSED',
          squadMandateId: `mock-mandate-may-${Date.now()}`,
          disbursedAt: T_MAY_FERTILIZER,
          expectedRepayBy: T_OCTOBER_HARVEST,
        },
      });
    }

    // ── LiberationLog: two harvest events captured this season ─────────
    // Row 1: ₦36k middleman discount avoided on March cassava sale (₦120k × 30%)
    // Row 2: ₦30k middleman discount avoided on June tomato sale (₦100k × 30%)
    // Row 3 (₦5k cash-on-day premium from Adamu's April wage) is seeded later
    //   inside the gigs block, since it FKs to the gig that hasn't been
    //   created yet at this point.
    // Citation strings match /methodology page footnotes verbatim.
    await prisma.liberationLog.create({
      data: {
        farmerId: TUNDE_FARMER_ID,
        source: 'MIDDLEMAN_DISCOUNT_AVOIDED',
        counterfactualLossKobo: 3600000n, // ₦36,000 = 30% of ₦120k
        loggedAt: T_MARCH_CASSAVA,
        methodologyNote:
          'Harvest inflow: ₦120,000 (March cassava sale). Counterfactual ' +
          'middleman discount estimated at 30% based on Babban Gona field ' +
          'observations and CGAP smallholder reports — ₦36,000 discount ' +
          'avoided. See /methodology.',
      },
    });

    await prisma.liberationLog.create({
      data: {
        farmerId: TUNDE_FARMER_ID,
        source: 'MIDDLEMAN_DISCOUNT_AVOIDED',
        counterfactualLossKobo: 3000000n, // ₦30,000 = 30% of ₦100k
        loggedAt: T_JUNE_TOMATO,
        methodologyNote:
          'Harvest inflow: ₦100,000 (June tomato sale). Counterfactual ' +
          'middleman discount estimated at 30% based on Babban Gona field ' +
          'observations and CGAP smallholder reports — ₦30,000 discount ' +
          'avoided. See /methodology.',
      },
    });

    // ── FactoringAdvance: Agbo Foods advances against Tunde's Oct harvest ──
    // ₦200k principal, 3% factoring fee, advanced ~40 days ago, due 7 days
    // after the projected October harvest.
    const aggregator = await prisma.aggregator.findFirst();
    if (aggregator) {
      await prisma.factoringAdvance.create({
        data: {
          aggregatorId: aggregator.id,
          farmerId: TUNDE_FARMER_ID,
          amount: 20000000n,                          // ₦200,000 principal
          fee: 600000n,                               // ₦6,000 = 3% factoring fee
          status: 'ADVANCED',
          advancedAt: daysAgo(40),
          expectedRepayBy: daysAhead(97),             // 7 days after Oct harvest
        },
      });
    }

    // Ensure split rule exists (55/25/20 canonical)
    await prisma.splitRule.upsert({
      where: { farmerId: TUNDE_FARMER_ID },
      update: { workingPct: 55, billsPct: 25, nextSeasonPct: 20 },
      create: {
        farmerId: TUNDE_FARMER_ID,
        workingPct: 55,
        billsPct: 25,
        nextSeasonPct: 20,
      },
    });

    // Generate fresh forecast (delete old ones + clear Redis cache so it regenerates)
    await prisma.cashGap.deleteMany({ where: { farmerId: TUNDE_FARMER_ID } });
    await prisma.forecastEvent.deleteMany({ where: { forecast: { farmerId: TUNDE_FARMER_ID } } });
    await prisma.forecast.deleteMany({ where: { farmerId: TUNDE_FARMER_ID } });
    await redis.del(`forecast:${TUNDE_FARMER_ID}`);
    await runForecast(TUNDE_FARMER_ID);

    // ── Inject realistic non-recurring expense events into the forecast ──
    // Prophet can't predict one-off events (school fees, equipment repair).
    // These two events extend the pre-harvest cash gap from ~8 days to ~3 weeks,
    // creating a demo-visible crunch period. They also make the Reasons Drawer
    // varied instead of 25 identical 'Recurring weekly household spend' rows.
    const freshestForecast = await prisma.forecast.findFirst({
      where: { farmerId: TUNDE_FARMER_ID },
      orderBy: { generatedAt: 'desc' },
    });
    if (freshestForecast) {
      const T_SCHOOL_FEES   = daysAhead(35);  // Q3 school fees
      const T_EQUIP_REPAIR  = daysAhead(55);  // Pump break-down

      await prisma.forecastEvent.createMany({
        data: [
          {
            forecastId: freshestForecast.id,
            expectedDate: T_SCHOOL_FEES,
            expectedAmount: 4500000n, // ₦45,000
            type: 'EXPENSE',
            category: 'HOUSEHOLD',
            confidence: 0.78,
            reasonsJson: [
              'School fees due end of Q3 term',
              'Three children in primary + secondary',
              'Recurring seasonal expense from prior years',
            ],
          },
          {
            forecastId: freshestForecast.id,
            expectedDate: T_EQUIP_REPAIR,
            expectedAmount: 3500000n, // ₦35,000
            type: 'EXPENSE',
            category: 'INPUTS',
            confidence: 0.55,
            reasonsJson: [
              'Irrigation pump nearing end of service life',
              'Pre-harvest equipment readiness',
              'Lower confidence — repair timing uncertain',
            ],
          },
        ],
      });

      // ── Recompute CashGap using Working balance as the starting point ─
      // Replicate Python's _detect_cash_gaps logic in TS so the gap reflects
      // the full event set (Prophet's + injected). Running balance starts at
      // Tunde's Working pot.
      const workingVA = accounts.find(a => a.purpose === 'WORKING');
      const startingKobo = Number(workingVA?.cachedBalance ?? 0n);

      const allEvents = await prisma.forecastEvent.findMany({
        where: { forecastId: freshestForecast.id },
        orderBy: { expectedDate: 'asc' },
      });

      let running = startingKobo;
      let gapStart: Date | null = null;
      let deepest = 0;
      const newGaps: Array<{ start: Date; end: Date; gapKobo: number }> = [];
      for (const ev of allEvents) {
        const delta = ev.type === 'INCOME' ? Number(ev.expectedAmount) : -Number(ev.expectedAmount);
        running += delta;
        if (running < 0) {
          if (gapStart === null) {
            gapStart = ev.expectedDate;
            deepest = running;
          } else if (running < deepest) {
            deepest = running;
          }
        } else if (running >= 0 && gapStart !== null) {
          newGaps.push({ start: gapStart, end: ev.expectedDate, gapKobo: Math.abs(deepest) });
          gapStart = null;
          deepest = 0;
        }
      }
      if (gapStart !== null) {
        newGaps.push({ start: gapStart, end: T_OCTOBER_HARVEST, gapKobo: Math.abs(deepest) });
      }

      // Replace Prophet's CashGap rows with the augmented set
      await prisma.cashGap.deleteMany({ where: { farmerId: TUNDE_FARMER_ID } });
      for (const g of newGaps) {
        await prisma.cashGap.create({
          data: {
            farmerId: TUNDE_FARMER_ID,
            startDate: g.start,
            endDate: g.end,
            gapAmount: BigInt(g.gapKobo),
            status: 'ACTIVE',
          },
        });
      }

      // Bust the Redis cache so /forecasts/me/current returns augmented events
      await redis.del(`forecast:${TUNDE_FARMER_ID}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // LABOURERS + GIGS + JOBS — August mid-season
    // Adamu: Tier 3, 6 completed gigs from this season (Apr–Jul), ₦210k earned,
    //   ₦40k savings (after household burn-down), 1 ACCEPTED pest control gig
    //   next week, eligible for wage advance.
    // Chidinma + Musa: profile diversity for matching (unchanged from prior seed).
    // Open harvest crew job posted by Tunde for October.
    // ═══════════════════════════════════════════════════════════════════

    // 1. Adamu user + labourer profile
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

    // Ensure Adamu has a LABOUR_SAVINGS VA, set to ₦40k after season burn-down
    const adamuVA = await prisma.virtualAccount.findFirst({
      where: { userId: adamuUser.id, purpose: 'LABOUR_SAVINGS' },
    });
    let adamuSavingsVAId: string;
    if (!adamuVA) {
      const newVA = await prisma.virtualAccount.create({
        data: {
          userId: adamuUser.id,
          squadAccountNumber: `010${Math.floor(Math.random() * 9000000) + 1000000}`,
          squadCustomerId: `mock-adamu-${Date.now()}`,
          bankName: 'GTBank',
          purpose: 'LABOUR_SAVINGS',
          cachedBalance: 4000000n, // ₦40,000 after household burn-down
        },
      });
      adamuSavingsVAId = newVA.id;
    } else {
      await prisma.virtualAccount.update({
        where: { id: adamuVA.id },
        data: { cachedBalance: 4000000n },
      });
      adamuSavingsVAId = adamuVA.id;
    }

    // We need an AGRO float VA as the WageTransfer fromVirtualAccountId for the
    // historic gigs. If one doesn't already exist (created by a real worker),
    // create a placeholder so the historic WageTransfer rows have valid FKs.
    let agroFloatVA = await prisma.virtualAccount.findFirst({
      where: { purpose: 'WORKING', farmerId: TUNDE_FARMER_ID },
    });
    // ^ The wages worker actually pays from the farmer's WORKING account,
    // so reusing Tunde's WORKING VA as the source FK is correct.

    // ── 6 historic PAID gigs for Adamu (this season's work) ─────────────
    // Each gig: own parent Job (FILLED), Gig (PAID), Rating, WageTransfer.
    // Adamu's first April wage also generates a LiberationLog cash-on-day row.
    const historicGigs = [
      { offsetDays: 110, title: 'Weeding (early season)',  amountKobo: 5000000n, rating: 5, skills: ['weeding'] },
      { offsetDays: 95,  title: 'Planting assistance',     amountKobo: 3500000n, rating: 4, skills: ['planting'] },
      { offsetDays: 80,  title: 'Land preparation',        amountKobo: 3000000n, rating: 5, skills: ['land-prep'] },
      { offsetDays: 60,  title: 'Mid-season weeding',      amountKobo: 4000000n, rating: 4, skills: ['weeding'] },
      { offsetDays: 35,  title: 'Fertilizer application',  amountKobo: 2500000n, rating: 5, skills: ['fertilizer-application'] },
      { offsetDays: 12,  title: 'Pesticide spray',         amountKobo: 3000000n, rating: 4, skills: ['pesticide-application'] },
    ];
    // Total: ₦50k + ₦35k + ₦30k + ₦40k + ₦25k + ₦30k = ₦210,000

    let firstGigId: string | null = null;
    for (let i = 0; i < historicGigs.length; i++) {
      const g = historicGigs[i];
      const acceptedAt        = daysAgo(g.offsetDays + 2);
      const farmerConfirmed   = daysAgo(g.offsetDays);
      const labourerConfirmed = daysAgo(g.offsetDays);
      const paidAt            = daysAgo(g.offsetDays - 1 < 0 ? 0 : g.offsetDays - 1);

      const job = await prisma.job.create({
        data: {
          farmerId: TUNDE_FARMER_ID,
          title: g.title,
          skillsRequired: g.skills,
          expectedDate: daysAgo(g.offsetDays + 1),
          durationDays: 1,
          payAmountKobo: g.amountKobo,
          workersNeeded: 1,
          status: 'FILLED',
        },
      });

      // Create WageTransfer first; Gig links back via wageTransferId
      const wt = await prisma.wageTransfer.create({
        data: {
          gigId: 'PLACEHOLDER', // updated below
          fromVirtualAccountId: agroFloatVA!.id,
          toVirtualAccountId: adamuSavingsVAId,
          amountKobo: g.amountKobo,
          squadTransferRef: `mock-wage-${i}-${Date.now()}`,
          status: 'SUCCEEDED',
          succeededAt: paidAt,
        },
      });

      const gig = await prisma.gig.create({
        data: {
          jobId: job.id,
          labourerId: adamu.id,
          agreedAmountKobo: g.amountKobo,
          status: 'PAID',
          acceptedAt,
          farmerConfirmedAt: farmerConfirmed,
          labourerConfirmedAt: labourerConfirmed,
          paidAt,
          wageTransferId: wt.id,
        },
      });

      // Patch the WageTransfer gigId now that we have the real Gig id
      await prisma.wageTransfer.update({
        where: { id: wt.id },
        data: { gigId: gig.id },
      });

      await prisma.rating.create({
        data: {
          gigId: gig.id,
          labourerId: adamu.id,
          farmerScoreOfLabourer: g.rating,
        },
      });

      if (firstGigId === null) {
        firstGigId = gig.id;
      }
    }

    // ── LiberationLog row 3: cash-on-day premium on Adamu's first April wage ──
    // 10% of ₦50,000 weeding wage = ₦5,000. FK'd to that specific gig.
    if (firstGigId) {
      await prisma.liberationLog.create({
        data: {
          farmerId: TUNDE_FARMER_ID,
          source: 'CASH_ON_DAY_PREMIUM_CAPTURED',
          counterfactualLossKobo: 500000n, // ₦5,000 = 10% of ₦50k
          loggedAt: daysAgo(108),
          gigId: firstGigId,
          methodologyNote:
            'Wage ₦50,000 paid same-day to Adamu via Squad. Premium estimate ' +
            'based on rural wage cash-handling premiums observed in IFAD West ' +
            'Africa Rural Finance studies — typical range 8–22%, conservative ' +
            '10% applied. ₦5,000 premium captured for the labourer. ' +
            'See /methodology.',
        },
      });
    }

    // Update Adamu's stats: Tier 3, 6 gigs, ₦210k earned
    // Average rating across [5,4,5,4,5,4] = 4.5 → Tier 3
    await prisma.labourer.update({
      where: { id: adamu.id },
      data: {
        totalGigsCompleted: 6,
        totalEarnedKobo: 21000000n, // ₦210,000
        reputationTier: 3,
      },
    });

    // 2. Two additional labourers for matching diversity
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

    // 3. OPEN October harvest crew job (workersNeeded: 2)
    const openJob = await prisma.job.create({
      data: {
        farmerId: TUNDE_FARMER_ID,
        title: 'Yam harvest crew needed (October)',
        description:
          'Need 2 labourers for 3 days to help harvest yam tubers. Tools ' +
          'provided. Hausa-speaking preferred. Same-day payment via Squad.',
        skillsRequired: ['harvest', 'weeding'],
        expectedDate: T_OCTOBER_HARVEST,
        durationDays: 3,
        payAmountKobo: 3500000n, // ₦35k per worker
        workersNeeded: 2,
        status: 'OPEN',
      },
    });

    // 3b. ACCEPTED pest control gig with Adamu, ~7 days from now
    const acceptedJob = await prisma.job.create({
      data: {
        farmerId: TUNDE_FARMER_ID,
        title: 'Pest control (pre-harvest spray)',
        description: 'Spray pesticide across yam field ahead of harvest.',
        skillsRequired: ['pesticide-application'],
        expectedDate: daysAhead(7),
        durationDays: 1,
        payAmountKobo: 2500000n, // ₦25k
        workersNeeded: 1,
        status: 'FILLED',
      },
    });

    await prisma.gig.create({
      data: {
        jobId: acceptedJob.id,
        labourerId: adamu.id,
        agreedAmountKobo: 2500000n,
        status: 'ACCEPTED',
        acceptedAt: daysAgo(2),
      },
    });

    // 4. Pre-compute embeddings synchronously (Adamu + open harvest job)
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

      // Embed open October harvest job
      const jobEmbRes = await fetch(`${aiBase}/embeddings/job`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${aiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Yam harvest crew needed (October)',
          description: 'Need 2 labourers for 3 days to help harvest yam tubers. Hausa-speaking preferred.',
          skillsRequired: ['harvest', 'weeding'],
          region: 'Oyo',
          durationDays: 3,
        }),
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


    const { recomputeCreditScore } = await import('../services/credit-score.service');
    await recomputeCreditScore(TUNDE_FARMER_ID);
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
// ─────────────────────────────────────────────────────────────────────
// GET /demo/replay/projection
// Returns the season story for Season Replay:
//   - history[]: real past events (Acts 1-3 in the replay)
//   - current:   live balances right now (Act 3, "you are here")
//   - projected: post-harvest end state (Act 4)
//   - facts:     numbers used to render labels
// Harvest amount is read from Prophet's ForecastEvent for credibility;
// falls back to ₦840k only if no future HARVEST_PAYMENT event exists.
// Zero DB writes. Safe to call any number of times.
// ─────────────────────────────────────────────────────────────────────
demoRouter.get('/replay/projection', async (_req: Request, res: Response, next) => {
  try {
    // Tunde (farmer)
    const tunde = await prisma.user.findUnique({
      where: { phone: '08012345678' },
      include: { farmer: true },
    });
    if (!tunde || !tunde.farmer) throw new AppError(404, 'Tunde not seeded');
    const farmerId = tunde.farmer.id;

    // Adamu (labourer)
    const adamu = await prisma.user.findUnique({
      where: { phone: '08055555555' },
      include: { labourer: true },
    });
    if (!adamu || !adamu.labourer) throw new AppError(404, 'Adamu not seeded');

    // Current balances
    const farmerAccounts = await prisma.virtualAccount.findMany({
      where: { farmerId },
    });
    const working = farmerAccounts.find((a) => a.purpose === 'WORKING');
    const bills = farmerAccounts.find((a) => a.purpose === 'BILLS');
    const nextSeason = farmerAccounts.find((a) => a.purpose === 'NEXT_SEASON');

    const adamuVA = await prisma.virtualAccount.findFirst({
      where: { userId: adamu.id, purpose: 'LABOUR_SAVINGS' },
    });

    // Split rule
    const rule = await prisma.splitRule.findUnique({ where: { farmerId } });
    const billsPct = rule?.billsPct ?? 25;
    const nextSeasonPct = rule?.nextSeasonPct ?? 20;
    const workingPct = 100 - billsPct - nextSeasonPct;

    // Active credit (to be repaid at harvest)
    const activeCredit = await prisma.inputDeferral.findFirst({
      where: { farmerId, status: { in: ['ACTIVE', 'PENDING', 'DISBURSED'] } },
      orderBy: { createdAt: 'desc' },
    });
    const creditPrincipal = activeCredit ? Number(activeCredit.amount) : 0;
    const creditFee = activeCredit ? Number(activeCredit.agroFee) : 0;
    const creditTotal = creditPrincipal + creditFee;

    // Liberation captured so far
    const libLogs = await prisma.liberationLog.findMany({
      where: { farmerId },
      orderBy: { loggedAt: 'asc' },
    });
    const liberationNow = libLogs.reduce(
      (sum, l) => sum + Number(l.counterfactualLossKobo ?? 0),
      0,
    );

    // ── HISTORY: real past events for Acts 1-3 ───────────────────────
    // Pull this season's harvest payments from Transactions (HARVEST_PAYMENT)
    // and the cash-on-day premium event from LiberationLog (gigId not null).
    const workingId = working?.id;
    const pastHarvestTxs = workingId
      ? await prisma.transaction.findMany({
          where: {
            virtualAccountId: workingId,
            source: 'HARVEST_PAYMENT',
            type: 'CREDIT',
          },
          orderBy: { occurredAt: 'asc' },
        })
      : [];

    const history = [
      ...pastHarvestTxs.map((t) => {
        const matchingLib = libLogs.find(
          (l) =>
            l.source === 'MIDDLEMAN_DISCOUNT_AVOIDED' &&
            Math.abs(l.loggedAt.getTime() - t.occurredAt.getTime()) < 24 * 60 * 60 * 1000,
        );
        const payload = (t.rawWebhookPayload ?? {}) as { description?: string };
        return {
          date: t.occurredAt.toISOString(),
          type: 'HARVEST_PAYMENT' as const,
          amountKobo: Number(t.amount),
          narrative: payload.description ?? 'Harvest payment',
          liberationKobo: matchingLib ? Number(matchingLib.counterfactualLossKobo) : 0,
        };
      }),
      ...libLogs
        .filter((l) => l.source === 'CASH_ON_DAY_PREMIUM_CAPTURED')
        .map((l) => ({
          date: l.loggedAt.toISOString(),
          type: 'WAGE_PAID' as const,
          amountKobo: 5000000, // ₦50k first Adamu wage (the one this lib log covers)
          narrative: 'First Adamu wage paid same-day via Squad',
          liberationKobo: Number(l.counterfactualLossKobo),
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    // ── Projection: harvest amount comes from Prophet's ForecastEvent ─
    const now = new Date();
    const futureHarvestEvent = await prisma.forecastEvent.findFirst({
      where: {
        forecast: { farmerId },
        category: 'HARVEST_PAYMENT',
        type: 'INCOME',
        expectedDate: { gte: now },
      },
      orderBy: { expectedDate: 'asc' },
    });
    const HARVEST_KOBO = futureHarvestEvent
      ? Number(futureHarvestEvent.expectedAmount)
      : 84_000_000; // fallback only if Prophet didn't run
    const harvestDate = futureHarvestEvent
      ? futureHarvestEvent.expectedDate.toISOString()
      : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const WAGE_KOBO = 3_500_000;     // ₦35k Oct harvest wage to Adamu
    const MIDDLEMAN_RATE = 0.30;
    const WAGE_PREMIUM_RATE = 0.10;

    // After harvest: split applied, then credit auto-repaid from working
    const harvestToWorking = Math.floor((HARVEST_KOBO * workingPct) / 100);
    const harvestToBills = Math.floor((HARVEST_KOBO * billsPct) / 100);
    const harvestToNextSeason = Math.floor((HARVEST_KOBO * nextSeasonPct) / 100);

    const projectedWorking =
      Number(working?.cachedBalance ?? 0n) + harvestToWorking - creditTotal;
    const projectedBills = Number(bills?.cachedBalance ?? 0n) + harvestToBills;
    const projectedNextSeason =
      Number(nextSeason?.cachedBalance ?? 0n) + harvestToNextSeason;
    const projectedAdamu = Number(adamuVA?.cachedBalance ?? 0n) + WAGE_KOBO;

    // Liberation gain at harvest
    const middlemanAvoided = Math.floor(HARVEST_KOBO * MIDDLEMAN_RATE);
    const wagePremium = Math.floor(WAGE_KOBO * WAGE_PREMIUM_RATE);
    const liberationGain = middlemanAvoided + wagePremium;
    const projectedLiberation = liberationNow + liberationGain;

    res.json({
      current: {
        working: Number(working?.cachedBalance ?? 0n),
        bills: Number(bills?.cachedBalance ?? 0n),
        nextSeason: Number(nextSeason?.cachedBalance ?? 0n),
        adamuSavings: Number(adamuVA?.cachedBalance ?? 0n),
        liberation: liberationNow,
        asOf: now.toISOString(),
      },
      history,
      projected: {
        working: projectedWorking,
        bills: projectedBills,
        nextSeason: projectedNextSeason,
        adamuSavings: projectedAdamu,
        liberation: projectedLiberation,
        harvestDate,
        harvestKobo: HARVEST_KOBO,
      },
      facts: {
        harvestKobo: HARVEST_KOBO,
        harvestDate,
        harvestFromProphet: Boolean(futureHarvestEvent),
        wageKobo: WAGE_KOBO,
        creditPrincipalKobo: creditPrincipal,
        creditFeeKobo: creditFee,
        middlemanAvoidedKobo: middlemanAvoided,
        wagePremiumKobo: wagePremium,
        splitRule: { workingPct, billsPct, nextSeasonPct },
        supplierName: 'Lagos Fertilizer Co.',
        labourerName: adamu.labourer.fullName,
        labourerTier: adamu.labourer.reputationTier,
      },
    });
  } catch (err) { next(err); }
});
