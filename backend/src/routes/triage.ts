import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { TriageResultModel, EducationalResourceModel } from '../models';
import { CURRENT_QUESTIONNAIRE } from '../modules/questionnaire/definition';
import { validateAnswers, pruneHiddenAnswers } from '../modules/questionnaire/branching';
import { Answers } from '../modules/questionnaire/types';
import { evaluate, DISCLAIMERS } from '../modules/triage/engine';
import { buildRecommendations, resourceTopicsFor } from '../modules/recommendations/engine';
import { SupportOption } from '../modules/triage/indicators';
import { loadProfileContext } from '../services/profileContext';
import { paginationQuery, pageMeta } from '../utils/pagination';
import { badRequest } from '../utils/errors';

export const triageRouter = Router();
triageRouter.use(requireAuth, requireRole('patient'));

const answerValue = z.union([z.string().max(2000), z.number(), z.boolean(), z.array(z.string().max(100)).max(30), z.null()]);

/** Stateless evaluation of a set of answers. Nothing is stored. */
triageRouter.post('/evaluate', validate({ body: z.object({ answers: z.record(z.string().max(64), answerValue) }) }), async (req, res) => {
  const answers = req.valid.body.answers as Answers;
  const issues = validateAnswers(CURRENT_QUESTIONNAIRE, answers, { requireComplete: false });
  if (issues.length) throw badRequest('Some answers are not valid', issues);
  const triage = evaluate(pruneHiddenAnswers(CURRENT_QUESTIONNAIRE, answers), await loadProfileContext(req.user!.id));
  res.json({ triage, recommendations: buildRecommendations(triage) });
});

triageRouter.get('/history', validate({ query: paginationQuery }), async (req, res) => {
  const p = req.valid.query;
  const filter = { user: req.user!.id };
  const [items, total] = await Promise.all([
    TriageResultModel.find(filter).sort({ createdAt: -1 }).skip((p.page - 1) * p.limit).limit(p.limit).lean(),
    TriageResultModel.countDocuments(filter),
  ]);
  res.json({ items, ...pageMeta(p, total) });
});

/** Recommendations for the dashboard, built from the latest stored result. */
export const recommendationsRouter = Router();
recommendationsRouter.use(requireAuth, requireRole('patient'));
recommendationsRouter.get('/', async (req, res) => {
  const latest = await TriageResultModel.findOne({ user: req.user!.id }).sort({ createdAt: -1 }).lean();
  if (!latest) {
    return res.json({ triage: null, recommendations: [], resources: [], disclaimers: DISCLAIMERS });
  }
  const t = { ...latest, disclaimers: DISCLAIMERS } as unknown as Parameters<typeof buildRecommendations>[0];
  const recommendations = buildRecommendations(t);
  const topics = Array.from(
    new Set([...resourceTopicsFor((latest.supportOptions ?? []) as SupportOption[]), ...recommendations.flatMap((r) => r.resourceTopics)]),
  );
  const resources = topics.length
    ? await EducationalResourceModel.find({ status: 'published', topics: { $in: topics as any[] } }).select('-body').limit(8).lean()
    : [];
  res.json({ triage: latest, recommendations, resources, disclaimers: DISCLAIMERS });
});
