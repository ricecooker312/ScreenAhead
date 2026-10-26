import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/tokens';
import { UserModel, Role } from '../models';
import { unauthorized, forbidden } from '../utils/errors';

export interface AuthUser {
  id: string;
  role: Role;
  clinicianVerified: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/** Verifies the bearer token and confirms the account is still active and the token not revoked. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized());
  try {
    const payload = verifyAccessToken(header.slice(7));
    const user = await UserModel.findById(payload.sub).select('role status tokenVersion clinician.verificationStatus').lean();
    if (!user || user.status !== 'active' || user.tokenVersion !== payload.ver) return next(unauthorized('Session expired. Please sign in again.'));
    req.user = {
      id: String(user._id),
      role: user.role as Role,
      clinicianVerified: user.clinician?.verificationStatus === 'verified',
    };
    next();
  } catch {
    next(unauthorized('Session expired. Please sign in again.'));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

export function requireVerifiedClinician(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'clinician' || !req.user.clinicianVerified)
    return next(forbidden('Your clinician account must be verified before you can connect with patients.'));
  next();
}
