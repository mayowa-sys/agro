import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; language: string };
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new AppError(401, 'Unauthorized'));
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as any;
    next();
  } catch {
    next(new AppError(401, 'Invalid token'));
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'Forbidden'));
    next();
  };
}
