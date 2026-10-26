import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { HealthProfileModel } from '../models';

export const healthProfileRouter = Router();
healthProfileRouter.use(requireAuth, requireRole('patient'));

const s = (max: number) => z.string().trim().max(max);

export const healthProfileBody = z
  .object({
    dateOfBirth: z.iso.date().optional().nullable(),
    age: z.number().int().min(0).max(120).optional().nullable(),
    heightCm: z.number().min(30).max(260).optional().nullable(),
    weightKg: z.number().min(2).max(400).optional().nullable(),
    medicalConditions: z.array(s(120)).max(50).optional(),
    cancerHistory: z
      .array(
        z.object({
          cancerType: s(120).optional(),
          diagnosedYear: z.number().int().min(1900).max(2100).optional(),
          status: z.enum(['current', 'remission', 'unknown']).optional(),
          treatments: z.array(s(120)).max(20).optional(),
        }),
      )
      .max(20)
      .optional(),
    currentTreatments: z.array(s(120)).max(20).optional(),
    previousTreatments: z.array(s(120)).max(20).optional(),
    allergies: z.array(z.object({ substance: s(120).min(1), reaction: s(300).optional() })).max(50).optional(),
    medications: z
      .array(z.object({ name: s(120).min(1), note: s(300).optional(), containsAcetaminophen: z.enum(['yes', 'no', 'unknown']).optional() }))
      .max(50)
      .optional(),
    familyHistory: z
      .array(
        z.object({
          relation: z.enum(['parent', 'sibling', 'child', 'grandparent', 'aunt_uncle', 'other']).optional(),
          condition: s(120).optional(),
          ageAtDiagnosis: z.number().int().min(0).max(120).optional(),
        }),
      )
      .max(30)
      .optional(),
    hereditarySyndromes: z.array(s(120)).max(10).optional(),
    geneticTestSummary: s(500).optional(),
    smoking: z.enum(['never', 'former', 'current', 'prefer_not']).optional().nullable(),
    alcohol: z.enum(['none', 'occasional', 'one_two_daily', 'three_plus_daily', 'prefer_not']).optional().nullable(),
    dietPattern: s(500).optional(),
    bowelHabits: s(500).optional(),
    existingProviders: z.array(z.object({ name: s(120).optional(), role: s(120).optional(), phone: s(30).optional() })).max(20).optional(),
    postalCode: s(12).optional(),
  })
  .strict();

healthProfileRouter.get('/', async (req, res) => {
  const profile = await HealthProfileModel.findOne({ user: req.user!.id }).lean();
  res.json(profile ?? { user: req.user!.id });
});

/** Full replace of the profile (fields left out are cleared). */
healthProfileRouter.put('/', validate({ body: healthProfileBody }), async (req, res) => {
  const doc = Object.fromEntries(Object.entries(req.valid.body).filter(([, v]) => v !== null));
  const profile = await HealthProfileModel.findOneAndReplace(
    { user: req.user!.id },
    { ...doc, user: req.user!.id },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).lean();
  res.json(profile);
});
