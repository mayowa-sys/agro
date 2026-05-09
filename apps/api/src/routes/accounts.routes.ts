import { Router } from 'express';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import {
  createThreeAccountsForFarmer,
  getFarmerAccounts,
  getAccountTransactions,
  refreshAccountBalance,
} from '../services/accounts.service';

export const accountsRouter = Router();

accountsRouter.use(requireAuth);
accountsRouter.use(requireRole('FARMER'));

// POST /accounts/setup — create three virtual accounts for the logged-in farmer
accountsRouter.post('/setup', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer profile not found'));
    const accounts = await createThreeAccountsForFarmer(farmer.id);
    res.json({ accounts });
  } catch (err) { next(err); }
});

// GET /accounts — list current farmer's three virtual accounts
accountsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer profile not found'));
    const accounts = await getFarmerAccounts(farmer.id);
    res.json({ accounts });
  } catch (err) { next(err); }
});

// GET /accounts/:id/transactions — paginated transaction list
accountsRouter.get('/:id/transactions', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer profile not found'));
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const result = await getAccountTransactions(String(req.params.id), farmer.id, page, pageSize);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /accounts/:id/refresh-balance — pull latest from Squad, update cache
accountsRouter.post('/:id/refresh-balance', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) return next(new AppError(404, 'Farmer profile not found'));
    const account = await refreshAccountBalance(String(req.params.id), farmer.id);
    res.json({ account });
  } catch (err) { next(err); }
});
