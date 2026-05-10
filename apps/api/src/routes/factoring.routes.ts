import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { factoringQueue } from '../lib/queues';

export const factoringRouter = Router();

// GET /aggregator/me/farmers
factoringRouter.get('/me/farmers', requireAuth, requireRole('AGGREGATOR'), async (req: AuthRequest, res, next) => {
  try {
    const aggregator = await prisma.aggregator.findUnique({ where: { userId: req.user!.id } });
    if (!aggregator) return next(new AppError(404, 'Aggregator not found'));
    const advances = await prisma.factoringAdvance.findMany({
      where: { aggregatorId: aggregator.id },
      include: { farmer: true },
      distinct: ['farmerId'],
    });
    const farmers = advances.map(a => a.farmer);
    res.json(farmers);
  } catch (err) { next(err); }
});

// POST /aggregator/me/farmers — add farmer by phone
factoringRouter.post('/me/farmers', requireAuth, requireRole('AGGREGATOR'), async (req: AuthRequest, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return next(new AppError(400, 'phone is required'));
    const user = await prisma.user.findUnique({ where: { phone }, include: { farmer: true } });
    if (!user?.farmer) return next(new AppError(404, 'No farmer found with that phone number'));
    res.json(user.farmer);
  } catch (err) { next(err); }
});

// POST /aggregator/factoring — request factoring advance
factoringRouter.post('/factoring', requireAuth, requireRole('AGGREGATOR'), async (req: AuthRequest, res, next) => {
  try {
    const { farmerId, deliveryAmount, expectedFinalPaymentDate } = req.body;
    if (!farmerId || !deliveryAmount || !expectedFinalPaymentDate) {
      return next(new AppError(400, 'farmerId, deliveryAmount, and expectedFinalPaymentDate are required'));
    }

    const aggregator = await prisma.aggregator.findUnique({ where: { userId: req.user!.id } });
    if (!aggregator) return next(new AppError(404, 'Aggregator not found'));

    const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
    if (!farmer) return next(new AppError(404, 'Farmer not found'));

    const deliveryAmountKobo = BigInt(Math.round(Number(deliveryAmount) * 100));
    // 3% Agro factoring fee
    const fee = (deliveryAmountKobo * 3n) / 100n;
    const advanceAmount = deliveryAmountKobo - fee;

    const advance = await prisma.factoringAdvance.create({
      data: {
        aggregatorId: aggregator.id,
        farmerId,
        amount: advanceAmount,
        fee,
        status: 'REQUESTED',
        expectedRepayBy: new Date(expectedFinalPaymentDate),
      },
    });

    await factoringQueue.add('advance', { advanceId: advance.id });

    res.status(201).json(advance);
  } catch (err) { next(err); }
});

// GET /aggregator/factoring — factoring history
factoringRouter.get('/factoring', requireAuth, requireRole('AGGREGATOR'), async (req: AuthRequest, res, next) => {
  try {
    const aggregator = await prisma.aggregator.findUnique({ where: { userId: req.user!.id } });
    if (!aggregator) return next(new AppError(404, 'Aggregator not found'));
    const advances = await prisma.factoringAdvance.findMany({
      where: { aggregatorId: aggregator.id },
      include: { farmer: true, liberationLog: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(advances);
  } catch (err) { next(err); }
});

// POST /aggregator/factoring/:id/confirm-repayment
factoringRouter.post('/factoring/:id/confirm-repayment', requireAuth, requireRole('AGGREGATOR'), async (req: AuthRequest, res, next) => {
  try {
    const aggregator = await prisma.aggregator.findUnique({ where: { userId: req.user!.id } });
    if (!aggregator) return next(new AppError(404, 'Aggregator not found'));

    const advance = await prisma.factoringAdvance.findUnique({ where: { id: String(req.params.id) } });    if (!advance) return next(new AppError(404, 'Factoring advance not found'));
    if (advance.aggregatorId !== aggregator.id) return next(new AppError(403, 'Not your advance'));
    if (advance.status !== 'ADVANCED') return next(new AppError(400, `Cannot confirm repayment in status ${advance.status}`));

    await prisma.factoringAdvance.update({
      where: { id: advance.id },
      data: { status: 'REPAID', repaidAt: new Date() },
    });

    res.json({ ok: true, message: 'Repayment confirmed' });
  } catch (err) { next(err); }
});

// GET /liberation/total — extended with source breakdown
factoringRouter.get('/total', requireAuth, async (_req, res, next) => {
  try {
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [weekLogs, monthLogs, allLogs] = await Promise.all([
      prisma.liberationLog.findMany({ where: { loggedAt: { gte: weekStart } } }),
      prisma.liberationLog.findMany({ where: { loggedAt: { gte: monthStart } } }),
      prisma.liberationLog.findMany(),
    ]);

    function breakdown(logs: typeof weekLogs) {
      let total = 0n;
      let byMiddlemanDiscount = 0n;
      let byCashOnDayPremium = 0n;
      for (const log of logs) {
        total += log.counterfactualLossKobo;
        if (log.source === 'MIDDLEMAN_DISCOUNT_AVOIDED') {
          byMiddlemanDiscount += log.counterfactualLossKobo;
        } else if (log.source === 'CASH_ON_DAY_PREMIUM_CAPTURED') {
          byCashOnDayPremium += log.counterfactualLossKobo;
        }
      }
      return {
        total: String(total),
        byMiddlemanDiscount: String(byMiddlemanDiscount),
        byCashOnDayPremium: String(byCashOnDayPremium),
      };
    }

    res.json({
      week: breakdown(weekLogs),
      month: breakdown(monthLogs),
      allTime: breakdown(allLogs),
    });
  } catch (err) { next(err); }
});

// GET /liberation/recent — extended with source and labour gig info
factoringRouter.get('/recent', requireAuth, async (_req, res, next) => {
  try {
    const logs = await prisma.liberationLog.findMany({
      include: {
        farmer: {
          select: { id: true, name: true }
        },
      },
      orderBy: { loggedAt: 'desc' },
      take: 20,
    });

    res.json(
        logs.map(log => ({
          id: log.id,
          farmerId: log.farmerId,
          farmerName: log.farmer.name,
          counterfactualLossKobo: String(log.counterfactualLossKobo),
          source: log.source,
          methodologyNote: log.methodologyNote,
          loggedAt: log.loggedAt.toISOString(),
        }))
    );
  } catch (err) {
    next(err);
  }
});