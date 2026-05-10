import { Router } from 'express';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import {
  createJob,
  getFarmerJobs,
  getJobById,
  updateJob,
  cancelJob,
  acceptJob,
} from '../services/jobs.service';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

const router = Router();

// POST /jobs — farmer creates a job
router.post('/', requireAuth, requireRole('FARMER'), async (req: AuthRequest, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) throw new AppError(404, 'Farmer profile not found');

    const { title, description, skillsRequired, expectedDate, durationDays, payAmountKobo, workersNeeded, sourceForecastEventId } = req.body;

    if (!title || !skillsRequired || !expectedDate || !payAmountKobo) {
      throw new AppError(400, 'title, skillsRequired, expectedDate, and payAmountKobo are required');
    }

    const job = await createJob(farmer.id, {
      title,
      description,
      skillsRequired,
      expectedDate,
      durationDays: durationDays ?? 1,
      payAmountKobo: BigInt(payAmountKobo),
      workersNeeded: workersNeeded ?? 1,
      sourceForecastEventId,
    });

    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

// GET /jobs/me — farmer's jobs
router.get('/me', requireAuth, requireRole('FARMER'), async (req: AuthRequest, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) throw new AppError(404, 'Farmer profile not found');

    const jobs = await getFarmerJobs(farmer.id);
    res.json(jobs);
  } catch (err) {
    next(err);
  }
});

// GET /jobs/:id — single job detail
router.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const job = await getJobById(String(req.params.id));
    res.json(job);
  } catch (err) {
    next(err);
  }
});

// PATCH /jobs/:id — update job (owner only, OPEN only)
router.patch('/:id', requireAuth, requireRole('FARMER'), async (req: AuthRequest, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) throw new AppError(404, 'Farmer profile not found');

    const updateData: any = {};
    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.skillsRequired !== undefined) updateData.skillsRequired = req.body.skillsRequired;
    if (req.body.expectedDate !== undefined) updateData.expectedDate = req.body.expectedDate;
    if (req.body.durationDays !== undefined) updateData.durationDays = req.body.durationDays;
    if (req.body.payAmountKobo !== undefined) updateData.payAmountKobo = BigInt(req.body.payAmountKobo);
    if (req.body.workersNeeded !== undefined) updateData.workersNeeded = req.body.workersNeeded;

    const job = await updateJob(String(req.params.id), farmer.id, updateData);
    res.json(job);
  } catch (err) {
    next(err);
  }
});

// POST /jobs/:id/cancel — farmer cancels their job
router.post('/:id/cancel', requireAuth, requireRole('FARMER'), async (req: AuthRequest, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) throw new AppError(404, 'Farmer profile not found');

    const job = await cancelJob(String(req.params.id), farmer.id);
    res.json(job);
  } catch (err) {
    next(err);
  }
});

// POST /jobs/:id/accept — labourer accepts a job
router.post('/:id/accept', requireAuth, requireRole('LABOURER'), async (req: AuthRequest, res, next) => {
  try {
    const labourer = await prisma.labourer.findUnique({ where: { userId: req.user!.id } });
    if (!labourer) throw new AppError(404, 'Labourer profile not found');

    const gig = await acceptJob(String(req.params.id), labourer.id);
    res.status(201).json(gig);
  } catch (err) {
    next(err);
  }
});

export { router as jobsRouter };
