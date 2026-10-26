import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { QuestionnaireModel, TriageResultModel } from '../models';
import { CURRENT_QUESTIONNAIRE, getDefinition } from '../modules/questionnaire/definition';
import { allVisibleQuestions, pruneHiddenAnswers, validateAnswers } from '../modules/questionnaire/branching';
import { Answers } from '../modules/questionnaire/types';
import { evaluate, evaluateEmergency } from '../modules/triage/engine';
import { buildRecommendations } from '../modules/recommendations/engine';
import { loadProfileContext } from '../services/profileContext';
import { idParams } from '../utils/objectId';
import { paginationQuery, pageMeta } from '../utils/pagination';
import { badRequest, notFound, conflict } from '../utils/errors';

export const questionnairesRouter = Router();
questionnairesRouter.use(requireAuth, requireRole('patient'));

const answerValue = z.union([z.string().max(2000), z.number(), z.boolean(), z.array(z.string().max(100)).max(30), z.null()]);
const answersSchema = z.record(z.string().max(64), answerValue).refine((a) => Object.keys(a).length <= 200, 'Too many answers');

/** Loads a questionnaire that belongs to the caller; other users' ids return 404. */
async function loadOwn(userId: string, id: string) {
  const q = await QuestionnaireModel.findOne({ _id: id, user: userId });
  if (!q) throw notFound('Questionnaire not found');
  return q;
}

/** Current definition plus the caller's latest in-progress questionnaire, if any. */
questionnairesRouter.get('/', async (req, res) => {
  const inProgress = await QuestionnaireModel.findOne({ user: req.user!.id, status: 'in_progress' }).sort({ updatedAt: -1 }).lean();
  res.json({ definition: CURRENT_QUESTIONNAIRE, inProgress });
});

questionnairesRouter.get('/history', validate({ query: paginationQuery }), async (req, res) => {
  const p = req.valid.query;
  const filter = { user: req.user!.id };
  const [items, total] = await Promise.all([
    QuestionnaireModel.find(filter).sort({ createdAt: -1 }).skip((p.page - 1) * p.limit).limit(p.limit).lean(),
    QuestionnaireModel.countDocuments(filter),
  ]);
  res.json({ items, ...pageMeta(p, total) });
});

questionnairesRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  const q = await loadOwn(req.user!.id, req.valid.params.id);
  res.json({ questionnaire: q, definition: getDefinition(q.version) });
});

questionnairesRouter.post('/', async (req, res) => {
  // Starting a new questionnaire abandons any earlier unfinished one.
  await QuestionnaireModel.updateMany({ user: req.user!.id, status: 'in_progress' }, { status: 'abandoned' });
  const q = await QuestionnaireModel.create({ user: req.user!.id, version: CURRENT_QUESTIONNAIRE.version, responses: {} });
  res.status(201).json({ questionnaire: q, definition: CURRENT_QUESTIONNAIRE });
});

/**
 * Saves answers for one or more questions (partial progress). Every save runs
 * the emergency rules, so the app can show an emergency screen immediately —
 * the user never has to finish the questionnaire first.
 */
questionnairesRouter.patch(
  '/:id',
  validate({ params: idParams, body: z.object({ answers: answersSchema, currentSection: z.string().max(64).optional() }) }),
  async (req, res) => {
    const q = await loadOwn(req.user!.id, req.valid.params.id);
    if (q.status !== 'in_progress') throw conflict('This questionnaire has already been submitted');
    const def = getDefinition(q.version)!;
    const merged: Answers = { ...(q.responses as Answers), ...req.valid.body.answers };
    for (const [k, v] of Object.entries(req.valid.body.answers)) if (v === null) delete merged[k];
    const issues = validateAnswers(def, req.valid.body.answers as Answers, { requireComplete: false });
    if (issues.length) throw badRequest('Some answers are not valid', issues);

    const emergencies = evaluateEmergency(merged, await loadProfileContext(req.user!.id));
    q.responses = merged;
    q.markModified('responses');
    q.currentSection = req.valid.body.currentSection ?? q.currentSection;
    if (emergencies.length && !q.emergencyShownAt) q.emergencyShownAt = new Date();
    await q.save();
    res.json({ questionnaire: q, safetyCheck: { emergency: emergencies.length > 0, warnings: emergencies } });
  },
);

questionnairesRouter.post('/:id/submit', validate({ params: idParams }), async (req, res) => {
  const q = await loadOwn(req.user!.id, req.valid.params.id);
  if (q.status !== 'in_progress') throw conflict('This questionnaire has already been submitted');
  const def = getDefinition(q.version)!;
  const answers = pruneHiddenAnswers(def, q.responses as Answers);
  const profile = await loadProfileContext(req.user!.id);
  const triage = evaluate(answers, profile);

  // An emergency result is always returned, even if other questions are unfinished.
  if (triage.careLevel !== 'emergency') {
    const issues = validateAnswers(def, answers, { requireComplete: true });
    if (issues.length) throw badRequest('Please answer the remaining required questions', issues);
  }

  q.responses = answers;
  q.markModified('responses');
  q.questionsPresented = allVisibleQuestions(def, answers).map((x) => x.id);
  q.status = 'submitted';
  q.submittedAt = new Date();
  await q.save();

  const result = await TriageResultModel.create({ user: req.user!.id, questionnaire: q._id, ...triage });
  res.json({ questionnaire: q, triage: { ...triage, id: result._id, createdAt: result.createdAt }, recommendations: buildRecommendations(triage) });
});
