import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, requireVerifiedClinician } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimit';
import { CareConnectionModel, MessageModel, UserModel, TriageResultModel, SHARE_SCOPES, ShareScope } from '../models';
import { sha256 } from '../services/tokens';
import { audit } from '../services/audit';
import { buildHealthSummary } from '../services/summary';
import { env } from '../config/env';
import { idParams } from '../utils/objectId';
import { paginationQuery, pageMeta } from '../utils/pagination';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { CONSENT_VERSION } from './auth';

/**
 * Patient ↔ clinician connections.
 *
 * Flow: the patient creates a one-time share code and chooses what to share.
 * They give the code to their clinician (in person, by phone, etc.). A verified
 * clinician enters the code to connect. The patient can change what is shared
 * or disconnect at any time. Messaging is for non-urgent questions only.
 */
export const connectionsRouter = Router();
connectionsRouter.use(requireAuth);

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid mix-ups
function newCode(): string {
  const bytes = crypto.randomBytes(8);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}
const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

const scopesSchema = z.array(z.enum(SHARE_SCOPES)).min(1).max(SHARE_SCOPES.length);

/** Loads a connection the caller is part of. Anything else → 404. */
async function loadForUser(userId: string, role: string, id: string, opts: { activeOnly?: boolean } = {}) {
  const filter: Record<string, unknown> = { _id: id };
  if (role === 'patient') filter.patient = userId;
  else if (role === 'clinician') filter.clinician = userId;
  else throw notFound('Connection not found');
  if (opts.activeOnly) filter.status = 'active';
  const c = await CareConnectionModel.findOne(filter);
  if (!c) throw notFound('Connection not found');
  return c;
}

connectionsRouter.post('/invite', requireRole('patient'), validate({ body: z.object({ scopes: scopesSchema }) }), async (req, res) => {
  const code = newCode();
  const expiresAt = new Date(Date.now() + env.SHARE_CODE_TTL_HOURS * 3600000);
  const scopes: ShareScope[] = req.valid.body.scopes;
  const connection = await CareConnectionModel.create({
    patient: req.user!.id,
    status: 'pending',
    scopes,
    codeHash: sha256(normalizeCode(code)),
    codeExpiresAt: expiresAt,
  });
  await UserModel.updateOne(
    { _id: req.user!.id },
    { $push: { consents: { type: 'clinician_sharing', version: CONSENT_VERSION, grantedAt: new Date() } } },
  );
  await audit(req, 'connection.invite_created', { targetType: 'CareConnection', targetId: String(connection._id), subjectUser: req.user!.id });
  // The plain code is returned once and never stored.
  res.status(201).json({ id: connection._id, code, expiresAt, scopes });
});

connectionsRouter.post(
  '/accept',
  authLimiter,
  requireRole('clinician'),
  requireVerifiedClinician,
  validate({ body: z.object({ code: z.string().trim().min(8).max(12) }) }),
  async (req, res) => {
    const c = await CareConnectionModel.findOne({ codeHash: sha256(normalizeCode(req.valid.body.code)), status: 'pending' });
    if (!c || !c.codeExpiresAt || c.codeExpiresAt < new Date()) throw badRequest('This code is not valid or has expired. Ask your patient for a new one.');
    const duplicate = await CareConnectionModel.exists({ patient: c.patient, clinician: req.user!.id, status: 'active' });
    if (duplicate) {
      c.status = 'expired';
      c.codeHash = undefined;
      await c.save();
      throw badRequest('You are already connected with this patient.');
    }
    c.clinician = req.user!.id as any;
    c.status = 'active';
    c.acceptedAt = new Date();
    c.codeHash = undefined; // single use
    await c.save();
    await audit(req, 'connection.accepted', { targetType: 'CareConnection', targetId: String(c._id), subjectUser: String(c.patient) });
    res.json({ id: c._id, status: c.status, scopes: c.scopes });
  },
);

connectionsRouter.get('/', async (req, res) => {
  const { id, role } = req.user!;
  if (role === 'patient') {
    const items = await CareConnectionModel.find({ patient: id, status: { $in: ['pending', 'active'] } })
      .select('-codeHash')
      .populate('clinician', 'displayName clinician.credentials clinician.specialty clinician.organization')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ items: items.filter((c) => c.status === 'active' || (c.codeExpiresAt && c.codeExpiresAt > new Date())) });
  }
  if (role !== 'clinician') throw forbidden();
  const items = await CareConnectionModel.find({ clinician: id, status: 'active' }).select('-codeHash').populate('patient', 'displayName').lean();
  // Add unread counts and, where the patient shares results, whether their latest guidance needs attention.
  const enriched = await Promise.all(
    items.map(async (c) => {
      const [unread, latest] = await Promise.all([
        MessageModel.countDocuments({ connection: c._id, senderRole: 'patient', readAt: null }),
        c.scopes?.includes('triage')
          ? TriageResultModel.findOne({ user: (c.patient as any)._id }).sort({ createdAt: -1 }).select('careLevel createdAt').lean()
          : null,
      ]);
      return {
        ...c,
        unreadCount: unread,
        latestGuidance: latest ? { careLevel: latest.careLevel, createdAt: latest.createdAt } : null,
        needsAttention: unread > 0 || latest?.careLevel === 'emergency' || latest?.careLevel === 'prompt',
      };
    }),
  );
  enriched.sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention));
  res.json({ items: enriched });
});

connectionsRouter.patch('/:id', requireRole('patient'), validate({ params: idParams, body: z.object({ scopes: scopesSchema }) }), async (req, res) => {
  const c = await loadForUser(req.user!.id, 'patient', req.valid.params.id);
  if (!['pending', 'active'].includes(c.status)) throw badRequest('This connection is no longer active');
  c.scopes = req.valid.body.scopes;
  await c.save();
  await audit(req, 'connection.scopes_changed', { targetType: 'CareConnection', targetId: String(c._id), subjectUser: req.user!.id });
  res.json({ id: c._id, scopes: c.scopes, status: c.status });
});

connectionsRouter.delete('/:id', validate({ params: idParams }), async (req, res) => {
  const c = await loadForUser(req.user!.id, req.user!.role, req.valid.params.id);
  c.status = 'revoked';
  c.revokedAt = new Date();
  c.revokedBy = req.user!.role === 'patient' ? 'patient' : 'clinician';
  c.codeHash = undefined;
  await c.save();
  await audit(req, 'connection.revoked', { targetType: 'CareConnection', targetId: String(c._id), subjectUser: String(c.patient) });
  res.status(204).end();
});

/** What a clinician can see about a connected patient — limited to the scopes the patient chose. */
connectionsRouter.get('/:id/summary', requireRole('clinician'), requireVerifiedClinician, validate({ params: idParams }), async (req, res) => {
  const c = await loadForUser(req.user!.id, 'clinician', req.valid.params.id, { activeOnly: true });
  const scopes = new Set(c.scopes ?? []);
  const sections = [
    scopes.has('summary') && 'profile',
    scopes.has('medications') && 'medications',
    scopes.has('symptoms') && 'symptoms',
    scopes.has('triage') && 'triage',
    scopes.has('summary') && 'appointments',
  ].filter(Boolean) as string[];
  const [summary, patient] = await Promise.all([
    buildHealthSummary(String(c.patient), sections),
    UserModel.findById(c.patient).select('displayName email contactPhone').lean(),
  ]);
  await audit(req, 'connection.summary_viewed', { targetType: 'CareConnection', targetId: String(c._id), subjectUser: String(c.patient) });
  res.json({
    connectionId: c._id,
    scopes: c.scopes,
    patient: {
      displayName: patient?.displayName ?? 'Patient',
      contact: scopes.has('contact') ? { email: patient?.email, phone: patient?.contactPhone ?? null } : null,
    },
    summary,
  });
});

connectionsRouter.get('/:id/messages', validate({ params: idParams, query: paginationQuery }), async (req, res) => {
  const c = await loadForUser(req.user!.id, req.user!.role, req.valid.params.id);
  if (!c.scopes?.includes('messages')) throw forbidden('Messaging is turned off for this connection');
  const p = req.valid.query;
  const [items, total] = await Promise.all([
    MessageModel.find({ connection: c._id }).sort({ createdAt: -1 }).skip((p.page - 1) * p.limit).limit(p.limit).lean(),
    MessageModel.countDocuments({ connection: c._id }),
  ]);
  // Mark the other side's messages as read.
  const otherRole = req.user!.role === 'patient' ? 'clinician' : 'patient';
  await MessageModel.updateMany({ connection: c._id, senderRole: otherRole, readAt: null }, { readAt: new Date() });
  if (req.user!.role === 'clinician')
    await audit(req, 'connection.messages_viewed', { targetType: 'CareConnection', targetId: String(c._id), subjectUser: String(c.patient) });
  res.json({ items, ...pageMeta(p, total), notice: 'Messages are not monitored around the clock. For emergencies call 911.' });
});

connectionsRouter.post(
  '/:id/messages',
  validate({
    params: idParams,
    body: z.object({ body: z.string().trim().min(1).max(4000), kind: z.enum(['text', 'check_in_request', 'appointment_request']).default('text') }),
  }),
  async (req, res) => {
    const c = await loadForUser(req.user!.id, req.user!.role, req.valid.params.id, { activeOnly: true });
    if (!c.scopes?.includes('messages')) throw forbidden('Messaging is turned off for this connection');
    if (req.user!.role === 'clinician' && !req.user!.clinicianVerified) throw forbidden();
    const msg = await MessageModel.create({
      connection: c._id,
      sender: req.user!.id,
      senderRole: req.user!.role as 'patient' | 'clinician',
      kind: req.valid.body.kind,
      body: req.valid.body.body,
    });
    res.status(201).json(msg);
  },
);
