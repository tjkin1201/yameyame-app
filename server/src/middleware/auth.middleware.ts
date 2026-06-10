import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  memberId: string;
  bandUserKey: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function signAuthToken(payload: AuthPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): Response | void {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'Auth not configured', hint: 'Set JWT_SECRET' });
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.auth = jwt.verify(header.slice('Bearer '.length), secret) as AuthPayload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
