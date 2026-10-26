import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { SymptomEntryModel } from '../models';
import { idParams } from '../utils/objectId';
import { paginationQuery, pageMeta } from '../utils/pagination';
import { notFound } from '../utils/errors';
import { evaluateEmergency } from '../modules/triage/engine';

export const symptomsRouter = Router();
symptomsRouter.use(requireAuth, requireRole('patient'));

const s = (max: number) => z.string().trim().max(max);
const symptomBody = z
  .object({
    symptomType: s(80).min(1),
    severity: z.number().int().min(1, 'Severity must be 1–10').max(10, 'Severity must be 1–10').nullable().optional(),
    startDate: z.iso.date().optional(),
    durationText: s(120).optional(),
    frequency: z.enum(['constant', 'intermittent', 'occasional', 'once']).optional(),
    associatedSymptoms: z.array(s(80)).max(20).optional(),
    changeSinceLast: z.enum(['better', 'same', 'worse', 'first_entry']).optional(),
    interventions: z.array(z.object({ measure: s(120), effect: z.enum(['helped', 'no_difference', 'worse', 'unsure']) })).max(10).optional(),
    notes: s(2000).optional(),
    notesForAppointment: s(2000).optional(),
    recordedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

/** Symptom names that, when logged, should prompt the user to re-check safety. */
const WATCH = ['bleeding', 'blood', 'breath', 'faint', 'vomit', 'black', 'fever', 'swollen'];

symptomsRouter.post('/', validate({ body: symptomBody }), async (req, res) => {
  const b = req.valid.body as z.infer<typeof symptomBody>;
  const entry = await SymptomEntryModel.create({ ...b, severity: b.severity ?? undefined, user: req.user!.id });
  const text = `${b.symptomType} ${(b.associatedSymptoms ?? []).join(' ')}`.toLowerCase();
  const suggestSafetyCheck =
    WATCH.some((w) => text.includes(w)) || (b.severity !== null && b.severity !== undefined && b.severity >= 7) || b.changeSinceLast === 'worse';
  res.status(201).json({
    entry,
    // Logging never replaces assessment; worsening or warning-type entries nudge a safety check.
    safetyNudge: suggestSafetyCheck
      ? 'This symptom may need a doctor’s attention. Take the quick safety check, or contact a doctor. In an emergency call 911.'
      : null,
  });
});

symptomsRouter.get(
  '/',
  validate({ query: paginationQuery.extend({ from: z.iso.date().optional(), to: z.iso.date().optional(), type: s(80).optional() }) }),
  async (req, res) => {
    const p = req.valid.query;
    const filter: Record<string, unknown> = { user: req.user!.id };
    if (p.type) filter.symptomType = p.type;
    if (p.from || p.to) filter.recordedAt = { ...(p.from && { $gte: new Date(p.from) }), ...(p.to && { $lte: new Date(p.to + 'T23:59:59Z') }) };
    const [items, total] = await Promise.all([
      SymptomEntryModel.find(filter).sort({ recordedAt: -1 }).skip((p.page - 1) * p.limit).limit(p.limit).lean(),
      SymptomEntryModel.countDocuments(filter),
    ]);
    res.json({ items, ...pageMeta(p, total) });
  },
);

symptomsRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  const entry = await SymptomEntryModel.findOne({ _id: req.valid.params.id, user: req.user!.id }).lean();
  if (!entry) throw notFound('Symptom entry not found');
  res.json(entry);
});

symptomsRouter.patch('/:id', validate({ params: idParams, body: symptomBody.partial() }), async (req, res) => {
  const entry = await SymptomEntryModel.findOneAndUpdate(
    { _id: req.valid.params.id, user: req.user!.id },
    { $set: req.valid.body },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!entry) throw notFound('Symptom entry not found');
  res.json(entry);
});

symptomsRouter.delete('/:id', validate({ params: idParams }), async (req, res) => {
  const r = await SymptomEntryModel.deleteOne({ _id: req.valid.params.id, user: req.user!.id });
  if (!r.deletedCount) throw notFound('Symptom entry not found');
  res.status(204).end();
});

// Re-exported so tests can confirm the symptom log never bypasses emergency rules.
export { evaluateEmergency };
