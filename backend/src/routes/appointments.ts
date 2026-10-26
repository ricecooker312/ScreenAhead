import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppointmentModel, ProviderModel } from '../models';
import { idParams, objectId } from '../utils/objectId';
import { paginationQuery, pageMeta } from '../utils/pagination';
import { badRequest, notFound } from '../utils/errors';

/** User-managed appointment tracker. Creating an entry does NOT book anything with a provider. */
export const appointmentsRouter = Router();
appointmentsRouter.use(requireAuth, requireRole('patient'));

const s = (max: number) => z.string().trim().max(max);
const body = z
  .object({
    title: s(160).min(1),
    startsAt: z.iso.datetime({ offset: true }),
    providerId: objectId.optional(),
    providerName: s(160).optional(),
    location: s(200).optional(),
    status: z.enum(['planned', 'confirmed', 'completed', 'cancelled']).optional(),
    notes: s(2000).optional(),
    questionsToAsk: z.array(s(300)).max(30).optional(),
    reminderMinutesBefore: z.number().int().min(0).max(20160).optional(),
  })
  .strict();

async function toDoc(b: Partial<z.infer<typeof body>>) {
  const { providerId, ...rest } = b;
  const doc: Record<string, unknown> = { ...rest };
  if (providerId) {
    const p = await ProviderModel.findById(providerId).select('name').lean();
    if (!p) throw badRequest('Provider not found');
    doc.provider = providerId;
    doc.providerName = rest.providerName ?? p.name;
  }
  return doc;
}

appointmentsRouter.get('/', validate({ query: paginationQuery.extend({ upcoming: z.enum(['true', 'false']).optional() }) }), async (req, res) => {
  const p = req.valid.query;
  const filter: Record<string, unknown> = { user: req.user!.id };
  if (p.upcoming === 'true') Object.assign(filter, { startsAt: { $gte: new Date() }, status: { $ne: 'cancelled' } });
  const [items, total] = await Promise.all([
    AppointmentModel.find(filter).sort({ startsAt: p.upcoming === 'true' ? 1 : -1 }).skip((p.page - 1) * p.limit).limit(p.limit).lean(),
    AppointmentModel.countDocuments(filter),
  ]);
  res.json({ items, ...pageMeta(p, total) });
});

appointmentsRouter.post('/', validate({ body }), async (req, res) => {
  const appt = await AppointmentModel.create({ ...(await toDoc(req.valid.body)), user: req.user!.id });
  res.status(201).json(appt);
});

appointmentsRouter.patch('/:id', validate({ params: idParams, body: body.partial() }), async (req, res) => {
  const appt = await AppointmentModel.findOneAndUpdate(
    { _id: req.valid.params.id, user: req.user!.id },
    { $set: await toDoc(req.valid.body) },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!appt) throw notFound('Appointment not found');
  res.json(appt);
});

appointmentsRouter.delete('/:id', validate({ params: idParams }), async (req, res) => {
  const r = await AppointmentModel.deleteOne({ _id: req.valid.params.id, user: req.user!.id });
  if (!r.deletedCount) throw notFound('Appointment not found');
  res.status(204).end();
});
