import { Router } from 'express';
import { verify } from '@node-rs/argon2';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  UserModel,
  HealthProfileModel,
  QuestionnaireModel,
  SymptomEntryModel,
  TriageResultModel,
  SavedProviderModel,
  AppointmentModel,
  CareConnectionModel,
  MessageModel,
  RefreshTokenModel,
  PasswordResetModel,
  ONBOARDING_CATEGORIES,
} from '../models';
import { audit } from '../services/audit';
import { buildHealthSummary } from '../services/summary';
import { notFound, unauthorized } from '../utils/errors';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/me', async (req, res) => {
  const user = await UserModel.findById(req.user!.id);
  if (!user) throw notFound();
  res.json(user.toJSON());
});

const patchMe = z.object({
  displayName: z.string().trim().max(80).optional(),
  onboardingCategories: z.array(z.enum(ONBOARDING_CATEGORIES)).max(8).optional(),
  onboardingComplete: z.boolean().optional(),
  contactPhone: z.string().trim().max(30).regex(/^[+\d\s().-]*$/, 'Use digits only').optional(),
  settings: z
    .object({
      preferredLanguage: z.string().max(10).optional(),
      largeText: z.boolean().optional(),
      reduceMotion: z.boolean().optional(),
      showDefinitions: z.boolean().optional(),
    })
    .optional(),
});

usersRouter.patch('/me', validate({ body: patchMe }), async (req, res) => {
  const b = req.valid.body as z.infer<typeof patchMe>;
  const update: Record<string, unknown> = {};
  if (b.displayName !== undefined) update.displayName = b.displayName;
  if (b.onboardingCategories) update.onboardingCategories = b.onboardingCategories;
  if (b.onboardingComplete !== undefined) update.onboardingComplete = b.onboardingComplete;
  if (b.contactPhone !== undefined) update.contactPhone = b.contactPhone;
  for (const [k, v] of Object.entries(b.settings ?? {})) if (v !== undefined) update[`settings.${k}`] = v;
  const user = await UserModel.findByIdAndUpdate(req.user!.id, { $set: update }, { returnDocument: 'after', runValidators: true });
  res.json(user!.toJSON());
});

/** Readable summary for sharing with a clinician. The user chooses sections. */
usersRouter.get(
  '/me/summary',
  validate({
    query: z.object({
      sections: z
        .string()
        .default('profile,medications,symptoms,triage,appointments')
        .transform((s) => s.split(',').filter(Boolean)),
    }),
  }),
  async (req, res) => {
    const summary = await buildHealthSummary(req.user!.id, req.valid.query.sections);
    await audit(req, 'user.summary_exported', { targetType: 'User', targetId: req.user!.id, subjectUser: req.user!.id });
    res.json(summary);
  },
);

/** Full machine-readable export of everything stored about the user (data portability). */
usersRouter.get('/me/export', async (req, res) => {
  const user = req.user!.id;
  const [account, profile, questionnaires, symptoms, triage, saved, appointments] = await Promise.all([
    UserModel.findById(user).lean(),
    HealthProfileModel.findOne({ user }).lean(),
    QuestionnaireModel.find({ user }).lean(),
    SymptomEntryModel.find({ user }).lean(),
    TriageResultModel.find({ user }).lean(),
    SavedProviderModel.find({ user }).lean(),
    AppointmentModel.find({ user }).lean(),
  ]);
  if (account) {
    delete (account as Record<string, unknown>).passwordHash;
    delete (account as Record<string, unknown>).tokenVersion;
  }
  await audit(req, 'user.data_exported', { targetType: 'User', targetId: user, subjectUser: user });
  res.json({ exportedAt: new Date(), account, profile, questionnaires, symptoms, triage, savedProviders: saved, appointments });
});

/**
 * Permanently deletes the account and all associated health data.
 * Requires the current password. Audit entries keep only ids, no health data.
 */
usersRouter.delete('/me', validate({ body: z.object({ password: z.string().min(1).max(128) }) }), async (req, res) => {
  const userId = req.user!.id;
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw notFound();
  const ok = await verify(user.passwordHash, req.valid.body.password).catch(() => false);
  if (!ok) throw unauthorized('Password is incorrect');
  await deleteUserData(userId);
  await audit(req, 'user.account_deleted', { actor: userId, targetType: 'User', targetId: userId });
  res.status(204).end();
});

export async function deleteUserData(userId: string) {
  const connections = await CareConnectionModel.find({ $or: [{ patient: userId }, { clinician: userId }] }).select('_id patient');
  const patientConnectionIds = connections.filter((c) => String(c.patient) === userId).map((c) => c._id);
  await Promise.all([
    HealthProfileModel.deleteMany({ user: userId }),
    QuestionnaireModel.deleteMany({ user: userId }),
    SymptomEntryModel.deleteMany({ user: userId }),
    TriageResultModel.deleteMany({ user: userId }),
    SavedProviderModel.deleteMany({ user: userId }),
    AppointmentModel.deleteMany({ user: userId }),
    RefreshTokenModel.deleteMany({ user: userId }),
    PasswordResetModel.deleteMany({ user: userId }),
    // A patient's messages belong to them and are removed with their connections.
    MessageModel.deleteMany({ connection: { $in: patientConnectionIds } }),
    CareConnectionModel.deleteMany({ patient: userId }),
    CareConnectionModel.updateMany({ clinician: userId }, { status: 'revoked', revokedAt: new Date(), revokedBy: 'clinician' }),
  ]);
  await UserModel.deleteOne({ _id: userId });
}
