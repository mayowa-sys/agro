import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../lib/errors';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { deferralsQueue } from '../lib/queues';
import { squadClient } from '../squad/squad.client';
import { BANK_CODES } from '../squad/squad.banks';
export const deferralsRouter = Router();

// GET /deferrals/suppliers
deferralsRouter.get('/suppliers', requireAuth, async (_req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({ where: { active: true } });
    res.json(suppliers);
  } catch (err) { next(err); }
});

// GET /deferrals/me
deferralsRouter.get('/me', requireAuth, requireRole('FARMER'), async (req: AuthRequest, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer not found'));
    const deferrals = await prisma.inputDeferral.findMany({
      where: { farmerId: farmer.id },
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(deferrals);
  } catch (err) { next(err); }
});

// POST /deferrals
//
// Credit limit enforcement:
//   - Hard floor: ₦1,000 minimum
//   - Hard ceiling: farmer's CreditScore.creditLimitKobo (alt-data scored, see §10.2)
//   - Cumulative cap: sum of currently outstanding (PENDING/DISBURSED/ACTIVE)
//     credits must not exceed the credit limit. Prevents stacking 10 small
//     credits to bypass the limit.
deferralsRouter.post('/', requireAuth, requireRole('FARMER'), async (req: AuthRequest, res, next) => {
  try {
    const { supplierId, amount, expectedRepayDate } = req.body;
    if (!supplierId || !amount || !expectedRepayDate) {
      return next(new AppError(400, 'supplierId, amount, and expectedRepayDate are required'));
    }
    const amountKobo = BigInt(Math.round(Number(amount) * 100));
    if (amountKobo < 100000n) return next(new AppError(400, 'Minimum input credit amount is ₦1,000'));

    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer not found'));

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier || !supplier.active) return next(new AppError(404, 'Supplier not found or inactive'));

    // ── Credit limit enforcement ─────────────────────────────────────
    const creditScore = await prisma.creditScore.findUnique({
      where: { farmerId: farmer.id },
    });
    const creditLimitKobo = creditScore?.creditLimitKobo ?? 2000000n; // Tier 1 default ₦20k

    const outstandingCredits = await prisma.inputDeferral.findMany({
      where: {
        farmerId: farmer.id,
        status: { in: ['PENDING', 'DISBURSED', 'ACTIVE'] },
      },
    });
    const outstandingKobo = outstandingCredits.reduce(
      (sum, c) => sum + c.amount + (c.agroFee ?? 0n),
      0n,
    );

    const availableKobo = creditLimitKobo - outstandingKobo;
    if (amountKobo > availableKobo) {
      const limitNaira = Number(creditLimitKobo) / 100;
      const outstandingNaira = Number(outstandingKobo) / 100;
      const availableNaira = Number(availableKobo > 0n ? availableKobo : 0n) / 100;
      return next(new AppError(
        400,
        `Amount exceeds available credit. ` +
        `Limit ₦${limitNaira.toLocaleString('en-NG')} · ` +
        `Outstanding ₦${outstandingNaira.toLocaleString('en-NG')} · ` +
        `Available ₦${availableNaira.toLocaleString('en-NG')}.`,
      ));
    }

    const feePct = Number(process.env.AGRO_INPUT_CREDIT_FEE_PCT || '6');
    const agroFee = (amountKobo * BigInt(feePct)) / 100n;

    const deferral = await prisma.inputDeferral.create({
      data: {
        farmerId: farmer.id,
        supplierId,
        amount: amountKobo,
        agroFee,
        status: 'PENDING',
        expectedRepayBy: new Date(expectedRepayDate),
      },
      include: { supplier: true },
    });

    res.status(201).json(deferral);

    // Auto-approve after 2.5s — gives the UI time to show "Reviewing…" beat.
    // In production this would be a BullMQ job with retry/audit trail.
    // In demo mode the setTimeout is intentionally fire-and-forget.
    const deferralId = deferral.id;
    const farmerId = farmer.id;
    setTimeout(async () => {
      try {
        const pending = await prisma.inputDeferral.findUnique({
          where: { id: deferralId },
          include: { supplier: true },
        });
        if (!pending || pending.status !== 'PENDING') return;

        const feePct = Number(process.env.AGRO_INPUT_CREDIT_FEE_PCT || '6');
        const feeKobo = (pending.amount * BigInt(feePct)) / 100n;
        const totalRepayKobo = pending.amount + feeKobo;

        const pendingLookup = await squadClient.lookupAccount(
          BANK_CODES.GTBANK,
          pending.supplier.squadAccountNumber,
        );
        await squadClient.initiateTransfer({
          amount: Number(pending.amount),
          account_number: pending.supplier.squadAccountNumber,
          account_name: pendingLookup.account_name,
          bank_code: BANK_CODES.GTBANK,
          currency_id: 'NGN',
          remark: `AGRO input credit to ${pending.supplier.name}`,
        }, `defer_${pending.id}`);

        await prisma.inputDeferral.update({
          where: { id: deferralId },
          data: { status: 'DISBURSED', disbursedAt: new Date(), agroFee: feeKobo },
        });

        // Coverage + repayment event + cache bust
        const freshestForecast = await prisma.forecast.findFirst({
          where: { farmerId },
          orderBy: { generatedAt: 'desc' },
        });
        if (freshestForecast) {
          const repayDate = pending.expectedRepayBy ?? new Date(Date.now() + 90 * 86400000);
          const candidates = await prisma.forecastEvent.findMany({
            where: {
              forecastId: freshestForecast.id,
              type: 'EXPENSE',
              category: { in: ['INPUTS', 'LABOUR', 'HOUSEHOLD'] },
              expectedDate: { lt: repayDate },
              coveredByCreditId: null,
            },
            orderBy: { expectedDate: 'asc' },
          });
          let remaining = pending.amount;
          for (const ev of candidates) {
            if (remaining <= 0n) break;
            const cover = ev.expectedAmount <= remaining ? ev.expectedAmount : remaining;
            await prisma.forecastEvent.update({
              where: { id: ev.id },
              data: { coveredByCreditId: deferralId, coveredKobo: cover },
            });
            remaining -= cover;
          }
          await prisma.forecastEvent.create({
            data: {
              forecastId: freshestForecast.id,
              expectedDate: repayDate,
              expectedAmount: totalRepayKobo,
              type: 'EXPENSE',
              category: 'REPAYMENT',
              confidence: 0.92,
              reasonsJson: [
                `Input credit repayment due to AGRO`,
                `Principal ₦${(Number(pending.amount) / 100).toLocaleString('en-NG')} + ${feePct}% AGRO fee`,
                `Auto-deducted from Working pot at next harvest inflow`,
              ],
            },
          });
          await redis.del(`forecast:${farmerId}`);
        }

        const { recomputeCreditScore } = await import('../services/credit-score.service');
        recomputeCreditScore(farmerId).catch(() => {});
        console.log(`[auto-approve] ${deferralId} approved and disbursed`);
      } catch (e) {
        console.warn('[auto-approve] failed:', e);
      }
    }, 2500);

  } catch (err) { next(err); }
});

// POST /deferrals/:id/approve
//
// Effects of approving a credit:
//   1. Squad transfer: AGRO float → supplier (fire actual transfer in non-mock)
//   2. Status PENDING → DISBURSED, recompute agroFee at env %
//   3. Inject a future ForecastEvent (EXPENSE / REPAYMENT) at expectedRepayBy
//      so the chart shows the upcoming obligation. Bust Redis cache so the
//      page re-renders fresh.
//   4. Recompute credit score (account-age + repayment-history components).
//
// We do NOT write a LiberationLog here. The middleman-discount-avoided
// liberation is logged by the splits worker at the moment of harvest
// repayment, where the 30% formula is honest (% of inflow, not principal).
deferralsRouter.post('/:id/approve', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const deferral = await prisma.inputDeferral.findUnique({
      where: { id: String(req.params.id) },
      include: { supplier: true },
    });
    if (!deferral) return next(new AppError(404, 'Deferral not found'));
    if (deferral.status !== 'PENDING') {
      return next(new AppError(400, `Cannot approve deferral in status ${deferral.status}`));
    }

    const feePct = Number(process.env.AGRO_INPUT_CREDIT_FEE_PCT || '6');
    const feeKobo = (deferral.amount * BigInt(feePct)) / 100n;
    const totalRepayKobo = deferral.amount + feeKobo;

    // 1. Disburse: AGRO float → supplier (real outbound)
    //
    // Squad spec requires account_name. In production each Supplier row
    // would carry verified bank details collected during onboarding;
    // for the demo seed we look it up live (or use a mock name in mock mode).
    const supplierLookup = await squadClient.lookupAccount(
      BANK_CODES.GTBANK,
      deferral.supplier.squadAccountNumber,
    );

    await squadClient.initiateTransfer({
      amount: Number(deferral.amount), // kobo (Squad expects kobo, not naira)
      account_number: deferral.supplier.squadAccountNumber,
      account_name: supplierLookup.account_name,
      bank_code: BANK_CODES.GTBANK,
      currency_id: 'NGN',
      remark: `AGRO input credit to ${deferral.supplier.name}`,
    }, `defer_${deferral.id}`);

    // 2. Mark DISBURSED
    const updated = await prisma.inputDeferral.update({
      where: { id: deferral.id },
      data: {
        status: 'DISBURSED',
        disbursedAt: new Date(),
        agroFee: feeKobo,
      },
    });

    // 3. Forecast: this credit covers actual pre-harvest expenses (inputs,
    //    pre-harvest labour, household if needed) — flag those events as
    //    covered so the gap math knows they're no longer Tunde's burden.
    //    Then inject ONE repayment EXPENSE event at the due date. Bust cache.
    try {
      const freshestForecast = await prisma.forecast.findFirst({
        where: { farmerId: deferral.farmerId },
        orderBy: { generatedAt: 'desc' },
      });
      if (freshestForecast) {
        // Greedy coverage: walk pre-repay-date EXPENSE events in INPUTS/LABOUR
        // /HOUSEHOLD categories (chronological), flagging coverage until the
        // principal is exhausted. Partial coverage on the last event is stored
        // in coveredKobo. We cover with the PRINCIPAL (not principal+fee) —
        // the fee is lender margin, not what reaches the supplier.
        const coverableCategories = ['INPUTS', 'LABOUR', 'HOUSEHOLD'];
        const repayDate = deferral.expectedRepayBy ?? new Date(Date.now() + 90 * 86400000);

        const candidates = await prisma.forecastEvent.findMany({
          where: {
            forecastId: freshestForecast.id,
            type: 'EXPENSE',
            category: { in: coverableCategories },
            expectedDate: { lt: repayDate },
            coveredByCreditId: null,
          },
          orderBy: { expectedDate: 'asc' },
        });

        let remaining = deferral.amount;
        for (const ev of candidates) {
          if (remaining <= 0n) break;
          const cover = ev.expectedAmount <= remaining ? ev.expectedAmount : remaining;
          await prisma.forecastEvent.update({
            where: { id: ev.id },
            data: {
              coveredByCreditId: deferral.id,
              coveredKobo: cover,
            },
          });
          remaining -= cover;
        }

        // Inject the repayment EXPENSE event at the due date
        await prisma.forecastEvent.create({
          data: {
            forecastId: freshestForecast.id,
            expectedDate: repayDate,
            expectedAmount: totalRepayKobo,
            type: 'EXPENSE',
            category: 'REPAYMENT',
            confidence: 0.92,
            reasonsJson: [
              `Input credit repayment due to AGRO`,
              `Principal ₦${(Number(deferral.amount) / 100).toLocaleString('en-NG')} + ${feePct}% AGRO fee`,
              `Auto-deducted from Working pot at next harvest inflow`,
            ],
          },
        });

        await redis.del(`forecast:${deferral.farmerId}`);
      }
    } catch (e) {
      console.warn('Forecast event injection / coverage flagging failed (non-fatal):', e);
    }

    // 4. Trigger credit score recompute (fire-and-forget)
    const { recomputeCreditScore } = await import('../services/credit-score.service');
    recomputeCreditScore(deferral.farmerId).catch(err => console.warn('Credit score recompute failed:', err));

    res.json(updated);
  } catch (err) { next(err); }
});

// POST /deferrals/:id/repay-now
deferralsRouter.post('/:id/repay-now', requireAuth, requireRole('FARMER'), async (req: AuthRequest, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer not found'));

    const deferral = await prisma.inputDeferral.findUnique({ where: { id: String(req.params.id) } });
    if (!deferral) return next(new AppError(404, 'Deferral not found'));
    if (deferral.farmerId !== farmer.id) return next(new AppError(403, 'Not your deferral'));
    if (deferral.status !== 'ACTIVE' && deferral.status !== 'DISBURSED') {
      return next(new AppError(400, `Cannot repay credit in status ${deferral.status}`));
    }

    await deferralsQueue.add('collect-repayment', {
      deferralId: deferral.id,
      farmerId: farmer.id,
      manual: true,
    });

    res.json({ ok: true, message: 'Manual repayment queued' });
  } catch (err) { next(err); }
});
