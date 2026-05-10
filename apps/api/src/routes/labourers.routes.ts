import { Router } from 'express';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import {
  createLabourer,
  getLabourerByUserId,
  updateLabourer,
  getLabourerDashboard,
  getReputation,
} from '../services/labourers.service';
import { AppError } from '../lib/errors';

const router = Router();

// POST /labourers — onboard as labourer
router.post('/', requireAuth, requireRole('LABOURER'), async (req: AuthRequest, res, next) => {
  try {
    const { fullName, region, state, latitude, longitude, skills, spokenLanguages } = req.body;

    if (!fullName || !region || !state) {
      throw new AppError(400, 'fullName, region, and state are required');
    }
    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      throw new AppError(400, 'skills must be a non-empty array');
    }
    if (!spokenLanguages || !Array.isArray(spokenLanguages) || spokenLanguages.length === 0) {
      throw new AppError(400, 'spokenLanguages must be a non-empty array');
    }

    const result = await createLabourer(req.user!.id, {
      fullName,
      region,
      state,
      latitude,
      longitude,
      skills,
      spokenLanguages,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /labourers/me
router.get('/me', requireAuth, requireRole('LABOURER'), async (req: AuthRequest, res, next) => {
  try {
    const labourer = await getLabourerByUserId(req.user!.id);
    res.json(labourer);
  } catch (err) {
    next(err);
  }
});

// PATCH /labourers/me
router.patch('/me', requireAuth, requireRole('LABOURER'), async (req: AuthRequest, res, next) => {
  try {
    const updated = await updateLabourer(req.user!.id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /labourers/me/dashboard
router.get('/me/dashboard', requireAuth, requireRole('LABOURER'), async (req: AuthRequest, res, next) => {
  try {
    const dashboard = await getLabourerDashboard(req.user!.id);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

// GET /labourers/me/reputation
router.get('/me/reputation', requireAuth, requireRole('LABOURER'), async (req: AuthRequest, res, next) => {
  try {
    const reputation = await getReputation(req.user!.id);
    res.json(reputation);
  } catch (err) {
    next(err);
  }
});

export { router as labourersRouter };
