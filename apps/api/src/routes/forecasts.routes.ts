import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { forecastsQueue } from '../lib/queues';
import { runForecast, runStressTest } from '../services/forecast.service';
import { redis } from '../lib/redis';

export const forecastsRouter = Router();

// GET /forecasts/me/current
forecastsRouter.get('/me/current', requireAuth, requireRole('FARMER'), async (req: AuthRequest, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer not found'));

    const forecast = await prisma.forecast.findFirst({
      where: { farmerId: farmer.id },
      orderBy: { generatedAt: 'desc' },
      include: { events: { orderBy: { expectedDate: 'asc' } } },
    });

    if (!forecast) {
      // Generate one on-demand if none exists
      const fresh = await runForecast(farmer.id);
      return res.json(fresh);
    }

    res.json(forecast);
  } catch (err) { next(err); }
});

// GET /forecasts/me/cash-gaps
forecastsRouter.get('/me/cash-gaps', requireAuth, requireRole('FARMER'), async (req: AuthRequest, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer not found'));

    const gaps = await prisma.cashGap.findMany({
      where: { farmerId: farmer.id },
      orderBy: { startDate: 'asc' },
    });
    res.json(gaps);
  } catch (err) { next(err); }
});

// POST /forecasts/me/regenerate
forecastsRouter.post('/me/regenerate', requireAuth, requireRole('FARMER'), async (req: AuthRequest, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer not found'));

    const rateLimitKey = `forecast:ratelimit:${farmer.id}`;
    const limited = await redis.get(rateLimitKey);
    if (limited) return next(new AppError(429, 'Forecast regeneration limited to once per hour'));

    await redis.del(`forecast:${farmer.id}`);
    await forecastsQueue.add('regenerate', { farmerId: farmer.id });
    await redis.set(rateLimitKey, '1', 'EX', 3600);

    res.json({ ok: true, message: 'Forecast regeneration queued' });
  } catch (err) { next(err); }
});

// POST /forecasts/me/stress-test
forecastsRouter.post('/me/stress-test', requireAuth, requireRole('FARMER'), async (req: AuthRequest, res, next) => {
  try {
    const { scenario } = req.body;
    if (!scenario) return next(new AppError(400, 'scenario is required'));

    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer not found'));

    const result = await runStressTest(farmer.id, scenario);
    res.json(result);
  } catch (err) { next(err); }
});
