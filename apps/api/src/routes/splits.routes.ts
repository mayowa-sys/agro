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

// POST /split-rules/me/suggest — AI suggestion (stub until §4 is done)
splitsRouter.post('/me/suggest', async (req: AuthRequest, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer profile not found'));

    // Stub: call AI service if available, otherwise return sensible default
    const aiUrl = process.env.AI_SERVICE_URL;
    if (aiUrl) {
      try {
        const axios = (await import('axios')).default;
        const current = await prisma.splitRule.findUnique({ where: { farmerId: farmer.id } });
        const { data } = await axios.post(
          `${aiUrl}/split/suggest`,
          { farmer_id: farmer.id, current_split: current },
          { headers: { Authorization: `Bearer ${process.env.AI_SERVICE_TOKEN}` }, timeout: 5000 }
        );
        return res.json({ suggestion: data, source: 'ai' });
      } catch {
        // AI service not up yet — fall through to default
      }
    }

    // Default suggestion based on crop type
    const suggestions: Record<string, { workingPct: number; billsPct: number; nextSeasonPct: number; reason: string }> = {
      YAM:     { workingPct: 55, billsPct: 25, nextSeasonPct: 20, reason: 'Yam has long gaps between harvests — save more for next season.' },
      CASSAVA: { workingPct: 60, billsPct: 20, nextSeasonPct: 20, reason: 'Cassava has two cycles — balanced split works well.' },
      TOMATO:  { workingPct: 65, billsPct: 25, nextSeasonPct: 10, reason: 'Tomato cash flow is frequent — keep more working.' },
      MAIZE:   { workingPct: 55, billsPct: 30, nextSeasonPct: 15, reason: 'Maize has a single spike — buffer bills more.' },
      RICE:    { workingPct: 55, billsPct: 25, nextSeasonPct: 20, reason: 'Rice input costs are high — save for next season.' },
      COCOA:   { workingPct: 50, billsPct: 25, nextSeasonPct: 25, reason: 'Cocoa has two big paydays — maximise next-season savings.' },
    };

    const suggestion = suggestions[farmer.cropType] ?? { workingPct: 60, billsPct: 25, nextSeasonPct: 15, reason: 'Default balanced split.' };
    res.json({ suggestion, source: 'default' });
  } catch (err) { next(err); }
});
