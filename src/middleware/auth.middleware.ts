import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import AuthRepo from '../modules/auth/auth.repository';
import { ACCESS_TOKEN_SECRET } from '../config';

type AuthUser = NonNullable<Awaited<ReturnType<typeof AuthRepo.findUserById>>>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const resolveUser = async (req: Request): Promise<AuthUser | null> => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;

  const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as { userId: string };
  const user = await AuthRepo.findUserById(decoded.userId);

  return user && !user.isDeleted ? user : null;
};

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const user = await resolveUser(req);
    // A token for a deleted or missing user is an authentication failure, not a
    // 404 — don't leak whether the account ever existed.
    if (!user) return res.status(401).json({ message: 'Invalid token' });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

/**
 * Populates `req.user` when a valid token is present, but allows the request
 * through when it isn't. For endpoints serving both guests and signed-in users
 * (e.g. the cart, which falls back to an `x-session-id` guest cart).
 */
export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const user = await resolveUser(req);
    if (user) req.user = user;
  } catch {
    // An invalid token is treated as "no token" here — the route still has to
    // work for guests, and its own ownership checks decide what's visible.
  }
  next();
};

/**
 * Restricts a route to the given roles. Must run after `authenticate`.
 *
 * Usage: router.patch('/:id/status', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), handler)
 */
export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };

/** Roles allowed to administer the platform (catalog, orders, CMS, suppliers). */
export const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DEVELOPER];
