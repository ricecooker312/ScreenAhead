import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { EducationalResourceModel, RESOURCE_TOPICS } from '../models';
import { paginationQuery, pageMeta } from '../utils/pagination';
import { notFound } from '../utils/errors';
import { objectId } from '../utils/objectId';

/** Public educational content. No authentication needed, so people can learn before signing up. */
export const resourcesRouter = Router();

const listQuery = paginationQuery.extend({ topic: z.enum(RESOURCE_TOPICS).optional(), q: z.string().trim().max(100).optional() });

async function list(req: any, res: any) {
  const f = req.valid.query as z.infer<typeof listQuery>;
  const filter: Record<string, unknown> = { status: 'published' };
  if (f.topic) filter.topics = f.topic;
  if (f.q) filter.$text = { $search: f.q };
  const [items, total] = await Promise.all([
    EducationalResourceModel.find(filter).select('-body').sort({ title: 1 }).skip((f.page - 1) * f.limit).limit(f.limit).lean(),
    EducationalResourceModel.countDocuments(filter),
  ]);
  res.json({ items, ...pageMeta(f, total), notice: 'General education only, not personal medical advice.' });
}

resourcesRouter.get('/', validate({ query: listQuery }), list);
resourcesRouter.get('/search', validate({ query: listQuery }), list);

resourcesRouter.get('/:id', validate({ params: z.object({ id: z.union([objectId, z.string().regex(/^[a-z0-9-]{1,100}$/)]) }) }), async (req, res) => {
  const id = req.valid.params.id as string;
  const r = await EducationalResourceModel.findOne({ status: 'published', ...(/^[a-f0-9]{24}$/i.test(id) ? { _id: id } : { slug: id }) }).lean();
  if (!r) throw notFound('Resource not found');
  res.json({ ...r, notice: 'General education only, not personal medical advice.' });
});
