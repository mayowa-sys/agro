import { Router } from 'express';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { aiClient } from '../lib/ai-client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import logger from '../lib/logger';

const router = Router();

// Labourer: get jobs matched to me
router.get('/jobs-for-me', requireAuth, requireRole('LABOURER'), async (req: AuthRequest, res, next) => {
  try {
    const labourer = await prisma.labourer.findUnique({ where: { userId: req.user!.id } });
    if (!labourer) throw new AppError(404, 'Labourer profile not found');

    const result = await aiClient.get(`/match/jobs-for-labourer/${labourer.id}`);

    // Log impressions to MatchFeedback (fire and forget)
    logMatchImpressions(labourer.id, result.data.matches || []).catch(err =>
      logger.warn('MatchFeedback log failed:', err)
    );

    res.json(result.data);
  } catch (err) {
    next(err);
  }
});

// Farmer: get labourers matched to a job they own
router.get('/labourers-for-job/:jobId', requireAuth, requireRole('FARMER'), async (req: AuthRequest, res, next) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: String(req.params.jobId) } });
    if (!job) throw new AppError(404, 'Job not found');

    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer || job.farmerId !== farmer.id) throw new AppError(403, 'Not your job');

    const result = await aiClient.get(`/match/labourers-for-job/${String(req.params.jobId)}`);
    res.json(result.data);
  } catch (err) {
    next(err);
  }
});

async function logMatchImpressions(labourerId: string, matches: any[]) {
  if (!matches.length) return;
  await prisma.matchFeedback.createMany({
    data: matches.map(m => ({
      jobId: m.jobId,
      labourerId,
      matchScore: m.matchScore,
      wasAccepted: false,
    })),
    skipDuplicates: true,
  });
}

export { router as matchRouter };
