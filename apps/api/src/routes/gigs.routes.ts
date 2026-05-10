import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import {
  getMyGigs,
  getGigById,
  confirmGigDone,
  cancelGig,
  rateGig,
} from '../services/gigs.service';
import { AppError } from '../lib/errors';

const router = Router();

// GET /gigs/me — list gigs for current user (auto-detect role)
router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const gigs = await getMyGigs(req.user!.id, req.user!.role);
    res.json(gigs);
  } catch (err) {
    next(err);
  }
});

// GET /gigs/:id — single gig detail
router.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const gig = await getGigById(String(req.params.id));
    res.json(gig);
  } catch (err) {
    next(err);
  }
});

// POST /gigs/:id/confirm-done
router.post('/:id/confirm-done', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const result = await confirmGigDone(String(req.params.id), req.user!.id, req.user!.role);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /gigs/:id/cancel
router.post('/:id/cancel', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) throw new AppError(400, 'reason is required');
    const gig = await cancelGig(String(req.params.id), req.user!.id, req.user!.role, reason);
    res.json(gig);
  } catch (err) {
    next(err);
  }
});

// POST /gigs/:id/rate
router.post('/:id/rate', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { score, comment } = req.body;
    if (!score) throw new AppError(400, 'score is required (1–5)');
    const rating = await rateGig(String(req.params.id), req.user!.id, req.user!.role, { score, comment });
    res.json(rating);
  } catch (err) {
    next(err);
  }
});

export { router as gigsRouter };
