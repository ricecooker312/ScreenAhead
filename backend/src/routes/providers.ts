import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ProviderModel, SavedProviderModel, SPECIALTIES } from '../models';
import { idParams } from '../utils/objectId';
import { paginationQuery, pageMeta } from '../utils/pagination';
import { notFound } from '../utils/errors';

export const providersRouter = Router();
providersRouter.use(requireAuth);

const filters = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  specialty: z.enum(SPECIALTIES).optional(),
  state: z.string().trim().max(50).optional(),
  city: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().regex(/^[A-Za-z0-9 -]{3,10}$/).optional(),
  telehealth: z.enum(['true', 'false']).optional(),
  language: z.string().trim().max(40).optional(),
  insurance: z.string().trim().max(80).optional(),
  verifiedOnly: z.enum(['true', 'false']).optional(),
  includeDemo: z.enum(['true', 'false']).default('true'),
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Hides attributes that are not verified, so the app never shows unconfirmed
 * insurance, telehealth or language claims as fact.
 */
export function presentProvider(p: Record<string, any>) {
  const out = { ...p };
  for (const key of ['insuranceAccepted', 'languages'] as const) {
    out[key] = p[key]?.verified ? { values: p[key].values, verifiedAt: p[key].verifiedAt, source: p[key].source } : null;
  }
  out.telehealth = p.telehealth?.verified ? { value: p.telehealth.value, verifiedAt: p.telehealth.verifiedAt } : null;
  out.label = p.isDemo
    ? 'Demonstration data — not a real provider'
    : p.verification?.status === 'verified'
      ? `Verified ${p.verification.lastVerifiedAt ? new Date(p.verification.lastVerifiedAt).toLocaleDateString('en-US') : ''}`.trim()
      : 'Not yet verified — please confirm details with the office';
  return out;
}

function buildFilter(f: z.infer<typeof filters>) {
  const filter: Record<string, unknown> = { active: true };
  if (f.specialty) filter.specialties = f.specialty;
  if (f.state) filter['location.state'] = new RegExp(`^${escapeRegex(f.state)}$`, 'i');
  if (f.city) filter['location.city'] = new RegExp(`^${escapeRegex(f.city)}$`, 'i');
  // Without a geocoding service we match on the 3-digit ZIP prefix (roughly a region).
  if (f.postalCode) filter['location.postalCode'] = new RegExp(`^${escapeRegex(f.postalCode.slice(0, 3))}`);
  if (f.telehealth === 'true') Object.assign(filter, { 'telehealth.value': true, 'telehealth.verified': true });
  if (f.language) Object.assign(filter, { 'languages.values': new RegExp(`^${escapeRegex(f.language)}$`, 'i'), 'languages.verified': true });
  if (f.insurance)
    Object.assign(filter, { 'insuranceAccepted.values': new RegExp(escapeRegex(f.insurance), 'i'), 'insuranceAccepted.verified': true });
  if (f.verifiedOnly === 'true') filter['verification.status'] = 'verified';
  if (f.includeDemo === 'false') filter.isDemo = false;
  if (f.q) filter.$text = { $search: f.q };
  return filter;
}

async function list(req: any, res: any) {
  const f = req.valid.query as z.infer<typeof filters>;
  const filter = buildFilter(f);
  const [items, total, saved] = await Promise.all([
    ProviderModel.find(filter).sort({ 'verification.status': -1, name: 1 }).skip((f.page - 1) * f.limit).limit(f.limit).lean(),
    ProviderModel.countDocuments(filter),
    SavedProviderModel.find({ user: req.user.id }).select('provider').lean(),
  ]);
  const savedIds = new Set(saved.map((s) => String(s.provider)));
  res.json({ items: items.map((p) => ({ ...presentProvider(p), saved: savedIds.has(String(p._id)) })), ...pageMeta(f, total) });
}

providersRouter.get('/', validate({ query: filters }), list);
providersRouter.get('/search', validate({ query: filters }), list);

providersRouter.get('/saved', async (req, res) => {
  const saved = await SavedProviderModel.find({ user: req.user!.id }).sort({ savedAt: -1 }).populate('provider').lean();
  res.json({ items: saved.filter((s) => s.provider).map((s) => ({ savedAt: s.savedAt, note: s.note, provider: presentProvider(s.provider as any) })) });
});

providersRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  const p = await ProviderModel.findOne({ _id: req.valid.params.id, active: true }).lean();
  if (!p) throw notFound('Provider not found');
  const saved = await SavedProviderModel.exists({ user: req.user!.id, provider: p._id } as any);
  res.json({ ...presentProvider(p), saved: !!saved });
});

providersRouter.post(
  '/:id/save',
  validate({ params: idParams, body: z.object({ note: z.string().trim().max(500).optional() }).optional() }),
  async (req, res) => {
    const exists = await ProviderModel.exists({ _id: req.valid.params.id, active: true });
    if (!exists) throw notFound('Provider not found');
    await SavedProviderModel.updateOne(
      { user: req.user!.id, provider: req.valid.params.id },
      { $setOnInsert: { user: req.user!.id, provider: req.valid.params.id }, ...(req.valid.body?.note && { $set: { note: req.valid.body.note } }) },
      { upsert: true },
    );
    res.status(201).json({ saved: true });
  },
);

providersRouter.delete('/:id/save', validate({ params: idParams }), async (req, res) => {
  await SavedProviderModel.deleteOne({ user: req.user!.id, provider: req.valid.params.id });
  res.status(204).end();
});
