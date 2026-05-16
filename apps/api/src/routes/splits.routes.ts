import { Router } from 'express';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';

export const splitsRouter = Router();

splitsRouter.use(requireAuth);
splitsRouter.use(requireRole('FARMER'));

// GET /split-rules/me — current rule
splitsRouter.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer profile not found'));

    let rule = await prisma.splitRule.findUnique({ where: { farmerId: farmer.id } });

    // Auto-create default rule if none exists
    if (!rule) {
      rule = await prisma.splitRule.create({
        data: { farmerId: farmer.id, workingPct: 60, billsPct: 25, nextSeasonPct: 15 },
      });
    }

    res.json({ rule });
  } catch (err) { next(err); }
});

// PUT /split-rules/me — update rule
splitsRouter.put('/me', async (req: AuthRequest, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer profile not found'));

    const { workingPct, billsPct, nextSeasonPct } = req.body;

    if (
      typeof workingPct !== 'number' ||
      typeof billsPct !== 'number' ||
      typeof nextSeasonPct !== 'number'
    ) {
      return next(new AppError(400, 'workingPct, billsPct, nextSeasonPct must all be numbers'));
    }

    if (workingPct + billsPct + nextSeasonPct !== 100) {
      return next(new AppError(400, 'Percentages must sum to 100'));
    }

    if ([workingPct, billsPct, nextSeasonPct].some(p => p < 0 || p > 100)) {
      return next(new AppError(400, 'Each percentage must be between 0 and 100'));
    }

    const rule = await prisma.splitRule.upsert({
      where: { farmerId: farmer.id },
      update: { workingPct, billsPct, nextSeasonPct, active: true },
      create: { farmerId: farmer.id, workingPct, billsPct, nextSeasonPct },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SPLIT_RULE_UPDATED',
        resource: 'SplitRule',
        metadata: { farmerId: farmer.id, workingPct, billsPct, nextSeasonPct },
      },
    });

    res.json({ rule });
  } catch (err) { next(err); }
});

// POST /split-rules/me/suggest — forecast-driven recommendation
//
// Simulates the farmer's next 90 days under the current split rule and a
// constrained grid of candidate rules. Returns the best candidate (if any)
// that materially reduces projected pot shortfalls.
//
// Honest about three outcomes:
//   - OPTIMAL:        current rule is fine, no adjustment recommended
//   - ADJUST:         a different rule meaningfully improves coverage
//   - CREDIT_NEEDED:  shortfall arrives before harvest income, splits can't fix
splitsRouter.post('/me/suggest', async (req: AuthRequest, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer profile not found'));

    // Current rule (auto-default if absent)
    let rule = await prisma.splitRule.findUnique({ where: { farmerId: farmer.id } });
    if (!rule) {
      rule = await prisma.splitRule.create({
        data: { farmerId: farmer.id, workingPct: 60, billsPct: 25, nextSeasonPct: 15 },
      });
    }

    // Pull the freshest forecast's events
    const freshestForecast = await prisma.forecast.findFirst({
      where: { farmerId: farmer.id },
      orderBy: { generatedAt: 'desc' },
    });

    const events = freshestForecast
      ? await prisma.forecastEvent.findMany({
          where: { forecastId: freshestForecast.id },
          orderBy: { expectedDate: 'asc' },
        })
      : [];

    // Current pot balances
    const accounts = await prisma.virtualAccount.findMany({ where: { farmerId: farmer.id } });
    const working    = accounts.find(a => a.purpose === 'WORKING');
    const bills      = accounts.find(a => a.purpose === 'BILLS');
    const nextSeason = accounts.find(a => a.purpose === 'NEXT_SEASON');

    // Active deferrals to model auto-repayment correctly
    const activeDeferrals = await prisma.inputDeferral.findMany({
      where: { farmerId: farmer.id, status: { in: ['DISBURSED', 'ACTIVE', 'PENDING'] } },
    });

    const { adviseSplit } = await import('../services/splits.advisor');

    const result = adviseSplit({
      current: {
        workingPct: rule.workingPct,
        billsPct: rule.billsPct,
        nextSeasonPct: rule.nextSeasonPct,
      },
      events: events.map(e => ({
        expectedDate: e.expectedDate,
        expectedAmount: e.expectedAmount,
        type: e.type as 'INCOME' | 'EXPENSE',
        category: e.category,
      })),
      balances: {
        working:    working?.cachedBalance ?? 0n,
        bills:      bills?.cachedBalance ?? 0n,
        nextSeason: nextSeason?.cachedBalance ?? 0n,
      },
      activeDeferrals: activeDeferrals
        .filter(d => d.expectedRepayBy !== null)
        .map(d => ({
          amount: d.amount,
          agroFee: d.agroFee,
          expectedRepayBy: d.expectedRepayBy!,
        })),
    });

    // Shape the response so the existing hook keeps working: flat
    // workingPct/billsPct/nextSeasonPct/explanation at the top of `suggestion`.
    // Recommended rule defaults to current when status != ADJUST so the
    // "Apply suggestion" button is safe in every state.
    const effective = result.recommended ?? result.current;
    res.json({
      suggestion: {
        workingPct: effective.workingPct,
        billsPct: effective.billsPct,
        nextSeasonPct: effective.nextSeasonPct,
        explanation: result.explanation,
        status: result.status,
        drivingEvent: result.drivingEvent,
        simulation: result.simulation,
        currentRule: result.current,
        recommendedRule: result.recommended,
      },
      source: 'advisor',
    });
  } catch (err) { next(err); }
});
