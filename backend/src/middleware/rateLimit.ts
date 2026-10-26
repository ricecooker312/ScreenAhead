import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env';

const common = { standardHeaders: 'draft-8' as const, legacyHeaders: false, skip: () => isTest };

export const apiLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 600 });

/** Stricter limit for credential endpoints to slow brute-force attempts. */
export const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' } },
});
