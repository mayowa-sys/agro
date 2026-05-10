import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const authRouter = Router();

function signToken(payload: object): string {
  const opts: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'] };
  return jwt.sign(payload, process.env.JWT_SECRET!, opts);
}

authRouter.post('/signup', async (req, res, next) => {
  try {
    const { phone, pin, role, language } = req.body;
    const hashedPin = await bcrypt.hash(pin, 10);
    const user = await prisma.user.create({ data: { phone, hashedPin, role, language } });
    const token = signToken({ id: user.id, role: user.role, language: user.language });
    res.json({ token, user: { id: user.id, phone: user.phone, role: user.role, language: user.language } });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError(409, 'Phone already registered'));
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { phone, pin } = req.body;
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !user.hashedPin || !(await bcrypt.compare(pin, user.hashedPin))) {
      return next(new AppError(401, 'Invalid credentials'));
    }
    const token = signToken({ id: user.id, role: user.role, language: user.language });
    res.json({ token, user: { id: user.id, phone: user.phone, role: user.role, language: user.language } });
  } catch (err) { next(err); }
});

authRouter.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    res.json(user);
  } catch (err) { next(err); }
});

authRouter.post('/demo-login', async (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !process.env.VITE_DEMO_MODE) {
    return next(new AppError(403, 'Demo login not available'));
  }
  try {
    const { farmerId, labourerPhone, phone } = req.body;
    const lookupPhone = phone || labourerPhone;

    if (farmerId) {
      const farmer = await prisma.farmer.findUnique({ where: { id: farmerId }, include: { user: true } });
      if (!farmer) return next(new AppError(404, 'Demo farmer not found'));
      const token = jwt.sign(
          { id: farmer.userId, role: 'FARMER', language: farmer.user.language },
          process.env.JWT_SECRET!,
          { expiresIn: '1d' } as SignOptions
      );
      return res.json({ token, user: { id: farmer.userId, phone: farmer.user.phone, role: 'FARMER' } });
    }

    if (lookupPhone) {
      // Try farmer first
      const farmer = await prisma.farmer.findFirst({ where: { user: { phone: lookupPhone } }, include: { user: true } });
      if (farmer) {
        const token = jwt.sign(
            { id: farmer.userId, role: 'FARMER', language: farmer.user.language },
            process.env.JWT_SECRET!,
            { expiresIn: '1d' } as SignOptions
        );
        return res.json({ token, user: { id: farmer.userId, phone: farmer.user.phone, role: 'FARMER' } });
      }

      // Try labourer
      const labourer = await prisma.labourer.findFirst({ where: { user: { phone: lookupPhone } }, include: { user: true } });
      if (labourer) {
        const token = jwt.sign(
            { id: labourer.userId, role: 'LABOURER', language: labourer.user.language },
            process.env.JWT_SECRET!,
            { expiresIn: '1d' } as SignOptions
        );
        return res.json({ token, user: { id: labourer.userId, phone: labourer.user.phone, role: 'LABOURER' } });
      }

      // Try aggregator
      const agg = await prisma.aggregator.findFirst({ where: { user: { phone: lookupPhone } }, include: { user: true } });
      if (agg) {
        const token = jwt.sign(
            { id: agg.userId, role: 'AGGREGATOR', language: agg.user.language },
            process.env.JWT_SECRET!,
            { expiresIn: '1d' } as SignOptions
        );
        return res.json({ token, user: { id: agg.userId, phone: agg.user.phone, role: 'AGGREGATOR' } });
      }

      return next(new AppError(404, 'Demo user not found'));
    }

    return next(new AppError(400, 'farmerId or phone required'));
  } catch (err) { next(err); }
});