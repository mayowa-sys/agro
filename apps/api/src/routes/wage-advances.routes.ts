import { Router, Request, Response } from 'express';
import {AuthRequest, requireAuth, requireRole} from '../middleware/auth';
import { prisma } from '../lib/prisma';


const router = Router();

// POST /wage-advances — request an advance (Tier 3+ labourers only)
router.post('/', requireAuth, requireRole('LABOURER'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const labourer = await prisma.labourer.findUnique({ where: { userId } });
    if (!labourer) return res.status(404).json({ error: 'Labourer profile not found' });

    if (labourer.reputationTier < 3) {
      return res.status(403).json({ error: 'Wage advances require Tier 3 or above' });
    }

    // Check no outstanding approved advance
    const outstanding = await prisma.wageAdvance.findFirst({
      where: { labourerId: labourer.id, status: 'APPROVED' },
    });
    if (outstanding) {
      return res.status(409).json({ error: 'You already have an outstanding advance' });
    }

    const { requestedKobo } = req.body;
    if (!requestedKobo || typeof requestedKobo !== 'number' || requestedKobo <= 0) {
      return res.status(400).json({ error: 'requestedKobo must be a positive number' });
    }

    // Cap: 50% of total earned, max ₦5,000 (500_000 kobo)
    const cap = Math.min(Number(labourer.totalEarnedKobo) * 0.5, 500_000);
    const approvedKobo = Math.min(requestedKobo, cap);
    const feePct = 2; // 2% flat fee on wage advances
    const feeKobo = Math.floor(approvedKobo * feePct / 100);
    const totalRepayable = approvedKobo + feeKobo;

    if (approvedKobo < 50_000) {
      return res.status(400).json({ error: 'Minimum advance is ₦500' });
    }

    const advance = await prisma.wageAdvance.create({
      data: {
        labourerId: labourer.id,
        requestedKobo: BigInt(requestedKobo),
        approvedKobo: BigInt(Math.floor(approvedKobo)),
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });

    return res.status(201).json(advance);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /wage-advances/me — labourer's advance history
router.get('/me', requireAuth, requireRole('LABOURER'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const labourer = await prisma.labourer.findUnique({ where: { userId } });
    if (!labourer) return res.status(404).json({ error: 'Labourer profile not found' });

    const advances = await prisma.wageAdvance.findMany({
      where: { labourerId: labourer.id },
      orderBy: { createdAt: 'desc' },
    });

    // Compute outstanding balance
    const outstanding = advances
      .filter(a => a.status === 'APPROVED')
      .reduce((sum, a) => sum + Number(a.approvedKobo) - Number(a.repaidKobo), 0);

    return res.json({ advances, outstandingKobo: outstanding });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
