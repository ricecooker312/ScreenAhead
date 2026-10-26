import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ProviderModel, UserModel, AuditLogModel, EducationalResourceModel, SPECIALTIES, RESOURCE_TOPICS } from '../models';
import { audit } from '../services/audit';
import { idParams } from '../utils/objectId';
import { paginationQuery, pageMeta } from '../utils/pagination';
import { notFound } from '../utils/errors';

/**
 * Administrative endpoints for directory, content and clinician verification.
 * Admins have no endpoint to read patients' health data. Every action is audited.
 */
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

const s = (max: number) => z.string().trim().max(max);
const verifiedList = z.object({ values: z.array(s(80)).max(50), verified: z.boolean(), source: s(300).optional() }).optional();
const providerBody = z.object({
  name: s(160).min(1),
  credentials: s(120).optional(),
  kind: z.enum(['individual', 'organization']).optional(),
  specialties: z.array(z.enum(SPECIALTIES)).min(1),
  focusAreas: z.array(s(120)).max(20).optional(),
  organization: s(200).optional(),
  location: z.object({ addressLine: s(200).optional(), city: s(100).optional(), state: s(50).optional(), postalCode: s(12).optional(), country: s(2).optional() }).optional(),
  serviceArea: s(200).optional(),
  contact: z.object({ phone: s(30).optional(), email: z.email().optional() }).optional(),
  website: z.url({ protocol: /^https$/ }).optional(),
  bookingUrl: z.url({ protocol: /^https$/ }).optional(),
  insuranceAccepted: verifiedList,
  languages: verifiedList,
  telehealth: z.object({ value: z.boolean(), verified: z.boolean(), source: s(300).optional() }).optional(),
  npi: z.string().regex(/^\d{10}$/).optional(),
  isDemo: z.boolean().default(false),
});

adminRouter.post('/providers', validate({ body: providerBody }), async (req, res) => {
  const b = req.valid.body;
  const p = await ProviderModel.create({ ...b, verification: { status: b.isDemo ? 'demo' : 'unverified' } });
  await audit(req, 'admin.provider_created', { targetType: 'Provider', targetId: String(p._id) });
  res.status(201).json(p);
});

adminRouter.patch('/providers/:id', validate({ params: idParams, body: providerBody.partial() }), async (req, res) => {
  const p = await ProviderModel.findByIdAndUpdate(req.valid.params.id, { $set: req.valid.body }, { returnDocument: 'after', runValidators: true });
  if (!p) throw notFound();
  await audit(req, 'admin.provider_updated', { targetType: 'Provider', targetId: String(p._id) });
  res.json(p);
});

/** Records that a person checked this provider against an authoritative source. */
adminRouter.post(
  '/providers/:id/verify',
  validate({ params: idParams, body: z.object({ source: s(300).min(3), status: z.enum(['verified', 'unverified']) }) }),
  async (req, res) => {
    const p = await ProviderModel.findById(req.valid.params.id);
    if (!p) throw notFound();
    if (p.isDemo) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Demonstration records cannot be marked verified' } });
    p.verification = { status: req.valid.body.status, source: req.valid.body.source, lastVerifiedAt: new Date(), verifiedBy: req.user!.id as any };
    await p.save();
    await audit(req, 'admin.provider_verification_changed', { targetType: 'Provider', targetId: String(p._id) });
    res.json(p);
  },
);

adminRouter.get('/clinicians', validate({ query: paginationQuery.extend({ status: z.enum(['pending', 'verified', 'rejected']).default('pending') }) }), async (req, res) => {
  const p = req.valid.query;
  const filter = { role: 'clinician' as const, 'clinician.verificationStatus': p.status as 'pending' | 'verified' | 'rejected' };
  const [items, total] = await Promise.all([
    UserModel.find(filter).select('email displayName clinician createdAt').skip((p.page - 1) * p.limit).limit(p.limit).lean(),
    UserModel.countDocuments(filter),
  ]);
  res.json({ items, ...pageMeta(p, total) });
});

adminRouter.post(
  '/clinicians/:id/verify',
  validate({ params: idParams, body: z.object({ status: z.enum(['verified', 'rejected']), source: s(300).min(3) }) }),
  async (req, res) => {
    const u = await UserModel.findOneAndUpdate(
      { _id: req.valid.params.id, role: 'clinician' },
      {
        'clinician.verificationStatus': req.valid.body.status,
        'clinician.verifiedAt': new Date(),
        'clinician.verificationSource': req.valid.body.source,
      },
      { returnDocument: 'after' },
    );
    if (!u) throw notFound();
    await audit(req, 'admin.clinician_verification_changed', { targetType: 'User', targetId: String(u._id) });
    res.json(u.toJSON());
  },
);

const resourceBody = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
  title: s(200).min(1),
  topics: z.array(z.enum(RESOURCE_TOPICS)).min(1),
  summary: s(600).min(1),
  body: s(20000).optional(),
  source: z.object({ name: s(200).min(1), url: z.url({ protocol: /^https$/ }), publishedOrReviewed: s(100).optional() }),
  lastReviewedAt: z.iso.date(),
  reviewedBy: s(200).optional(),
  status: z.enum(['draft', 'published', 'retired']).default('draft'),
});

adminRouter.put('/resources', validate({ body: resourceBody }), async (req, res) => {
  const r = await EducationalResourceModel.findOneAndUpdate({ slug: req.valid.body.slug }, req.valid.body, { upsert: true, returnDocument: 'after', runValidators: true });
  await audit(req, 'admin.resource_upserted', { targetType: 'EducationalResource', targetId: String(r._id) });
  res.json(r);
});

adminRouter.get('/audit-logs', validate({ query: paginationQuery }), async (req, res) => {
  const p = req.valid.query;
  const [items, total] = await Promise.all([
    AuditLogModel.find().sort({ createdAt: -1 }).skip((p.page - 1) * p.limit).limit(p.limit).lean(),
    AuditLogModel.countDocuments(),
  ]);
  await audit(req, 'admin.audit_logs_viewed');
  res.json({ items, ...pageMeta(p, total) });
});
