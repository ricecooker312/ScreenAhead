import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  TriageResultModel,
  SymptomEntryModel,
  AppointmentModel,
  SavedProviderModel,
  HealthProfileModel,
  QuestionnaireModel,
  EducationalResourceModel,
  CareConnectionModel,
  MessageModel,
} from '../models';
import { resourceTopicsFor } from '../modules/recommendations/engine';
import { DISCLAIMERS } from '../modules/triage/engine';
import { SupportOption } from '../modules/triage/indicators';
import { presentProvider } from './providers';

/**
 * Everything the home dashboard needs in one call. Deliberately excludes the
 * internal numeric indicators so no "risk score" is ever displayed.
 */
export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, requireRole('patient'));

dashboardRouter.get('/', async (req, res) => {
  const user = req.user!.id;
  const [latest, symptoms, appointments, saved, profile, inProgress, connections] = await Promise.all([
    TriageResultModel.findOne({ user }).sort({ createdAt: -1 }).lean(),
    SymptomEntryModel.find({ user }).sort({ recordedAt: -1 }).limit(5).lean(),
    AppointmentModel.find({ user, startsAt: { $gte: new Date() }, status: { $ne: 'cancelled' } }).sort({ startsAt: 1 }).limit(3).lean(),
    SavedProviderModel.find({ user }).sort({ savedAt: -1 }).limit(3).populate('provider').lean(),
    HealthProfileModel.findOne({ user }).select('medications allergies').lean(),
    QuestionnaireModel.findOne({ user, status: 'in_progress' }).select('_id currentSection updatedAt').lean(),
    CareConnectionModel.find({ patient: user, status: 'active' }).select('_id').lean(),
  ]);
  const unreadMessages = connections.length
    ? await MessageModel.countDocuments({ connection: { $in: connections.map((c) => c._id) }, senderRole: 'clinician', readAt: null })
    : 0;

  let nextAction = { title: 'Take the health check', detail: 'A few short questions help us show you the right next steps.', action: 'questionnaire' };
  let activeWarnings: unknown[] = [];
  let resources: unknown[] = [];
  let questionsForClinician: string[] = [];
  if (latest) {
    const step = latest.nextSteps?.[0];
    nextAction = step ? { title: step.title ?? nextAction.title, detail: step.detail ?? '', action: step.id ?? 'questionnaire' } : nextAction;
    activeWarnings = (latest.warnings ?? []).filter((w) => w.level === 'emergency' || w.level === 'prompt');
    const topics = resourceTopicsFor((latest.supportOptions ?? []) as SupportOption[]);
    resources = await EducationalResourceModel.find({ status: 'published', topics: { $in: (topics.length ? topics : ['symptoms']) as any[] } })
      .select('title summary topics slug source')
      .limit(4)
      .lean();
    questionsForClinician = [
      ...(latest.warnings ?? []).filter((w) => w.level === 'prompt').map((w) => `What could be causing my ${w.title?.toLowerCase()}?`),
      'What tests, if any, do you recommend?',
      'When should I come back or call you?',
    ].slice(0, 5);
  } else {
    resources = await EducationalResourceModel.find({ status: 'published' }).select('title summary topics slug source').limit(4).lean();
  }

  res.json({
    nextAction,
    activeWarnings,
    lastCheckAt: latest?.createdAt ?? null,
    careLevel: latest?.careLevel ?? null,
    recentSymptoms: symptoms,
    upcomingAppointments: appointments,
    savedProviders: saved.filter((s) => s.provider).map((s) => presentProvider(s.provider as any)),
    resources,
    medications: profile?.medications ?? [],
    allergies: profile?.allergies ?? [],
    questionsForClinician,
    inProgressQuestionnaire: inProgress,
    unreadMessages,
    disclaimers: DISCLAIMERS,
  });
});
