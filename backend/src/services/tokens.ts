import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { RefreshTokenModel, UserDoc } from '../models';
import { unauthorized } from '../utils/errors';

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString('base64url');

interface AccessPayload {
  sub: string;
  role: string;
  ver: number;
}

export function signAccessToken(user: Pick<UserDoc, '_id' | 'role' | 'tokenVersion'>): string {
  return jwt.sign({ sub: String(user._id), role: user.role, ver: user.tokenVersion ?? 0 }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
    issuer: 'carecompass',
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: 'carecompass' }) as unknown as AccessPayload;
}

export async function issueRefreshToken(userId: string, family = randomToken(16), userAgent?: string): Promise<string> {
  const token = randomToken();
  await RefreshTokenModel.create({
    user: userId,
    tokenHash: sha256(token),
    family,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000),
    userAgent: userAgent?.slice(0, 200),
  });
  return token;
}

/**
 * Rotates a refresh token. If an already-used token is presented again, the
 * whole token family is revoked (likely theft).
 */
export async function rotateRefreshToken(token: string, userAgent?: string): Promise<{ userId: string; refreshToken: string }> {
  const record = await RefreshTokenModel.findOne({ tokenHash: sha256(token) });
  if (!record || record.expiresAt < new Date()) throw unauthorized('Session expired. Please sign in again.');
  if (record.revokedAt) {
    await RefreshTokenModel.updateMany({ family: record.family, revokedAt: null }, { revokedAt: new Date() });
    throw unauthorized('Session expired. Please sign in again.');
  }
  const next = await issueRefreshToken(String(record.user), record.family, userAgent);
  record.revokedAt = new Date();
  record.replacedBy = sha256(next);
  await record.save();
  return { userId: String(record.user), refreshToken: next };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await RefreshTokenModel.updateOne({ tokenHash: sha256(token), revokedAt: null }, { revokedAt: new Date() });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await RefreshTokenModel.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
}
