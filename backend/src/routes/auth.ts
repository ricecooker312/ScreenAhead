import { Router } from 'express';
import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/auth';
import { UserModel, PasswordResetModel, ONBOARDING_CATEGORIES } from '../models';
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken, revokeAllForUser, randomToken, sha256 } from '../services/tokens';
import { emailSender } from '../services/email';
import { audit } from '../services/audit';
import { env } from '../config/env';
import { badRequest, conflict, unauthorized } from '../utils/errors';

export const CONSENT_VERSION = '2026-10-draft';

// OWASP-recommended Argon2id parameters (memory 19 MiB, 2 iterations).
const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
export const hashPassword = (pw: string) => hash(pw, ARGON_OPTS);

const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Use letters and at least one number');

const registerBody = z.object({
  email: z.email().max(254),
  password,
  displayName: z.string().trim().max(80).optional(),
  role: z.enum(['patient', 'clinician']).default('patient'),
  onboardingCategories: z.array(z.enum(ONBOARDING_CATEGORIES)).max(8).default([]),
  acceptTerms: z.literal(true, { message: 'You must accept the terms to continue' }),
  acceptPrivacy: z.literal(true, { message: 'You must accept the privacy notice to continue' }),
  consentHealthData: z.literal(true, { message: 'We need your permission to store health information' }),
  clinician: z
    .object({
      credentials: z.string().trim().min(2).max(120),
      specialty: z.string().trim().min(2).max(120),
      organization: z.string().trim().max(200).optional(),
      npi: z.string().regex(/^\d{10}$/, 'NPI must be 10 digits').optional(),
    })
    .optional(),
});

const loginBody = z.object({ email: z.email(), password: z.string().min(1).max(128) });
const refreshBody = z.object({ refreshToken: z.string().min(20).max(200) });

export const authRouter = Router();

async function sessionFor(user: InstanceType<typeof UserModel>, userAgent?: string) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(String(user._id), undefined, userAgent),
    user: user.toJSON(),
  };
}

authRouter.post('/register', authLimiter, validate({ body: registerBody }), async (req, res) => {
  const b = req.valid.body as z.infer<typeof registerBody>;
  if (b.role === 'clinician' && !b.clinician) throw badRequest('Clinician details are required for clinician accounts');
  const exists = await UserModel.exists({ email: b.email.toLowerCase() });
  if (exists) throw conflict('An account with this email already exists');
  const now = new Date();
  const user = await UserModel.create({
    email: b.email,
    passwordHash: await hashPassword(b.password),
    displayName: b.displayName,
    role: b.role,
    onboardingCategories: b.onboardingCategories,
    onboardingComplete: b.onboardingCategories.length > 0,
    consents: [
      { type: 'terms', version: CONSENT_VERSION, grantedAt: now },
      { type: 'privacy', version: CONSENT_VERSION, grantedAt: now },
      { type: 'health_data', version: CONSENT_VERSION, grantedAt: now },
    ],
    clinician: b.role === 'clinician' ? { ...b.clinician, verificationStatus: 'pending' } : undefined,
  });
  await audit(req, 'auth.register', { actor: String(user._id), actorRole: user.role, targetType: 'User', targetId: String(user._id) });
  res.status(201).json(await sessionFor(user, req.get('user-agent')));
});

authRouter.post('/login', authLimiter, validate({ body: loginBody }), async (req, res) => {
  const { email, password: pw } = req.valid.body as z.infer<typeof loginBody>;
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  // Same response for unknown email and wrong password, to avoid account enumeration.
  const ok = user && user.status === 'active' && (await verify(user.passwordHash, pw).catch(() => false));
  if (!user || !ok) throw unauthorized('Email or password is incorrect');
  user.lastLoginAt = new Date();
  await user.save();
  res.json(await sessionFor(user, req.get('user-agent')));
});

authRouter.post('/refresh', authLimiter, validate({ body: refreshBody }), async (req, res) => {
  const { userId, refreshToken } = await rotateRefreshToken(req.valid.body.refreshToken, req.get('user-agent'));
  const user = await UserModel.findById(userId);
  if (!user || user.status !== 'active') throw unauthorized('Session expired. Please sign in again.');
  res.json({ accessToken: signAccessToken(user), refreshToken });
});

authRouter.post('/logout', requireAuth, validate({ body: refreshBody.partial() }), async (req, res) => {
  if (req.valid.body.refreshToken) await revokeRefreshToken(req.valid.body.refreshToken);
  res.status(204).end();
});

/** Signs out every device by revoking refresh tokens and invalidating access tokens. */
authRouter.post('/logout-all', requireAuth, async (req, res) => {
  await revokeAllForUser(req.user!.id);
  await UserModel.updateOne({ _id: req.user!.id }, { $inc: { tokenVersion: 1 } });
  res.status(204).end();
});

authRouter.post('/forgot-password', authLimiter, validate({ body: z.object({ email: z.email() }) }), async (req, res) => {
  const user = await UserModel.findOne({ email: req.valid.body.email.toLowerCase(), status: 'active' });
  if (user) {
    const token = randomToken(32);
    await PasswordResetModel.create({
      user: user._id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60000),
    });
    await emailSender.send({
      to: user.email,
      subject: 'Reset your CareCompass password',
      text: `Use this link to reset your password. It expires in ${env.PASSWORD_RESET_TTL_MINUTES} minutes.\n\n${env.PASSWORD_RESET_URL}?token=${token}\n\nIf you did not ask for this, you can ignore this email.`,
    });
    await audit(req, 'auth.password_reset_requested', { actor: String(user._id), targetType: 'User', targetId: String(user._id) });
  }
  // Always the same response, whether or not the account exists.
  res.json({ message: 'If an account exists for that email, we have sent a reset link.' });
});

authRouter.post(
  '/reset-password',
  authLimiter,
  validate({ body: z.object({ token: z.string().min(20).max(200), newPassword: password }) }),
  async (req, res) => {
    const record = await PasswordResetModel.findOne({ tokenHash: sha256(req.valid.body.token) });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw badRequest('This reset link is invalid or has expired');
    record.usedAt = new Date();
    await record.save();
    await UserModel.updateOne(
      { _id: record.user },
      { passwordHash: await hashPassword(req.valid.body.newPassword), $inc: { tokenVersion: 1 } },
    );
    await revokeAllForUser(String(record.user));
    await audit(req, 'auth.password_reset_completed', { actor: String(record.user), targetType: 'User', targetId: String(record.user) });
    res.json({ message: 'Your password has been changed. Please sign in.' });
  },
);
