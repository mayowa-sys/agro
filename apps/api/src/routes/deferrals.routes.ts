import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { deferralsQueue } from '../lib/queues';
import { squadClient } from '../squad/squad.client';
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
deferralsRouter.post('/', requireAuth, requireRole('FARMER'), async (req: AuthRequest, res, next) => {
  try {
    const { supplierId, amount, expectedRepayDate } = req.body;
    if (!supplierId || !amount || !expectedRepayDate) {
      return next(new AppError(400, 'supplierId, amount, and expectedRepayDate are required'));
    }
    const amountKobo = BigInt(Math.round(Number(amount) * 100));
    if (amountKobo < 100000n) return next(new AppError(400, 'Minimum deferral amount is ₦1,000'));

    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer not found'));

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier || !supplier.active) return next(new AppError(404, 'Supplier not found or inactive'));

    const agroFee = (amountKobo * 2n) / 100n;

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
  } catch (err) { next(err); }
});

// POST /deferrals/:id/approve
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
    const feeKobo = deferral.agroFee ?? (deferral.amount * BigInt(feePct) / 100n);
    const totalRepay = deferral.amount + (deferral.amount * BigInt(feePct) / 100n);

    // 1. Disburse: AGRO float → supplier
    await squadClient.initiateTransfer({
      amount: Number(deferral.amount) / 100, // kobo → naira
      account_number: deferral.supplier.squadAccountNumber,
      bank_code: '057', // GTBank default
      currency_id: 'NGN',
      remark: `AGRO input credit to ${deferral.supplier.name}`,
    });

    // 2. Mark DISBURSED
    const updated = await prisma.inputDeferral.update({
      where: { id: deferral.id },
      data: {
        status: 'DISBURSED',
        disbursedAt: new Date(),
        agroFee: feeKobo,
      },
    });

    // 3. Write LiberationLog with methodology
    const formula = [
      `₦${Number(deferral.amount / 100n)} disbursed to supplier.`,
      `Counterfactual middleman discount estimated at 30% based on Babban Gona field observations and CGAP smallholder reports.`,
      `Expected repayment ₦${Number(totalRepay / 100n)} (principal + ${feePct}% AGRO fee).`,
    ].join(' ');

    await prisma.liberationLog.create({
      data: {
        farmerId: deferral.farmerId,
        source: 'MIDDLEMAN_DISCOUNT_AVOIDED',
        counterfactualLossKobo: deferral.amount,
        methodologyNote: formula,
      },
    });

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
    if (deferral.status !== 'ACTIVE') {
      return next(new AppError(400, `Cannot repay deferral in status ${deferral.status}`));
    }

    await deferralsQueue.add('collect-repayment', {
      deferralId: deferral.id,
      farmerId: farmer.id,
      manual: true,
    });

    res.json({ ok: true, message: 'Manual repayment queued' });
  } catch (err) { next(err); }
});
