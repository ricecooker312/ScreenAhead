import { TriageOutput } from '../triage/engine';
import { SupportOption } from '../triage/indicators';

export type RecommendationCategory =
  | 'emergency'
  | 'professional_assessment'
  | 'medication_info'
  | 'comfort_support'
  | 'nutrition'
  | 'screening_risk'
  | 'emotional_support'
  | 'survivorship'
  | 'caregiver'
  | 'insufficient_information';

export interface RecommendationCard {
  category: RecommendationCategory;
  title: string;
  body: string;
  bullets?: string[];
  resourceTopics: string[];
  specialties: string[];
}

const TOPICS_FOR: Partial<Record<SupportOption, string[]>> = {
  professional_assessment: ['symptoms', 'diagnostic_tests'],
  gastroenterology: ['diagnostic_tests', 'symptoms'],
  oncology_team: ['treatment', 'side_effects'],
  screening_discussion: ['screening'],
  genetic_counseling: ['family_history'],
  medication_info: ['pain_comfort'],
  comfort_measures: ['pain_comfort'],
  emotional_support: ['emotional_wellbeing'],
  nutrition: ['nutrition'],
  survivorship: ['survivorship'],
  caregiver_support: ['caregiver'],
  second_opinion: ['treatment'],
};

export function resourceTopicsFor(options: SupportOption[]): string[] {
  return Array.from(new Set(options.flatMap((o) => TOPICS_FOR[o] ?? [])));
}

/**
 * Turns a triage output into the cards on the results screen. The safety
 * level decides what may be shown: in an emergency only the emergency card is
 * returned, so nothing distracts from getting help.
 */
export function buildRecommendations(t: TriageOutput): RecommendationCard[] {
  if (t.careLevel === 'emergency') {
    return [
      {
        category: 'emergency',
        title: 'Get emergency help now',
        body: t.warnings[0]?.message ?? 'Call 911 or your local emergency number now.',
        bullets: t.warnings.map((w) => w.explanation),
        resourceTopics: [],
        specialties: [],
      },
    ];
  }

  const cards: RecommendationCard[] = [];
  const has = (o: SupportOption) => t.supportOptions.includes(o);

  if (t.careLevel === 'insufficient_information') {
    cards.push({
      category: 'insufficient_information',
      title: 'Let’s get you to the right person',
      body: 'We could not give safe advice from these answers. A doctor or nurse can help you work out what is going on.',
      resourceTopics: [],
      specialties: ['primary_care'],
    });
  }

  if (t.careLevel === 'prompt' || (has('professional_assessment') && t.careLevel !== 'insufficient_information')) {
    cards.push({
      category: 'professional_assessment',
      title: 'Talk with a health professional',
      body:
        'Your answers suggest that talking with a health professional about these symptoms would be a good next step. ' +
        'This questionnaire cannot tell what is causing them. You can find specialists below.',
      bullets: t.warnings.filter((w) => w.level === 'prompt').map((w) => w.message),
      resourceTopics: ['symptoms', 'diagnostic_tests'],
      specialties: Array.from(new Set(t.nextSteps.map((s) => s.specialty).filter((s): s is string => !!s))),
    });
  }

  if (t.medication.status !== 'not_requested') {
    cards.push({
      category: 'medication_info',
      title: t.medication.title,
      body: t.medication.message,
      bullets: [...t.medication.reasons, ...t.medication.cautions],
      resourceTopics: ['pain_comfort'],
      specialties: [],
    });
  }

  if (t.comfort.show && (has('comfort_measures') || has('emotional_support'))) {
    cards.push({
      category: 'comfort_support',
      title: 'Ways to feel more comfortable',
      body: t.comfort.note ?? '',
      bullets: t.comfort.options.map((o) => `${o.title}: ${o.detail}`),
      resourceTopics: ['pain_comfort', 'emotional_wellbeing'],
      specialties: [],
    });
  }

  if (has('screening_discussion') || has('genetic_counseling')) {
    cards.push({
      category: 'screening_risk',
      title: 'Screening and your risk',
      body:
        'Your risk depends on things like age, family history, past polyps (small growths in the bowel), inherited conditions, and other health history. ' +
        'A doctor can tell you when and how to be screened. Age alone does not decide this.',
      resourceTopics: ['screening', 'family_history'],
      specialties: has('genetic_counseling') ? ['primary_care', 'genetic_counseling'] : ['primary_care'],
    });
  }

  if (has('nutrition')) {
    cards.push({
      category: 'nutrition',
      title: 'Food and healthy habits',
      body:
        'Eating well can help you feel stronger. No single diet prevents, treats or cures cancer. ' +
        'If eating is hard during treatment, an oncology dietitian (a food expert for people with cancer) can help.',
      resourceTopics: ['nutrition'],
      specialties: ['oncology_dietitian'],
    });
  }

  if (has('emotional_support')) {
    cards.push({
      category: 'emotional_support',
      title: 'You are not alone',
      body: 'Feeling worried or sad is normal. Counselors, support groups and helplines are there for you.',
      resourceTopics: ['emotional_wellbeing'],
      specialties: ['mental_health'],
    });
  }

  if (has('survivorship')) {
    cards.push({
      category: 'survivorship',
      title: 'Life after treatment',
      body: 'Regular check-ups and a survivorship care plan (a plan for follow-up visits) help you stay on track.',
      resourceTopics: ['survivorship'],
      specialties: ['rehabilitation_survivorship'],
    });
  }

  if (has('caregiver_support')) {
    cards.push({
      category: 'caregiver',
      title: 'Support for caregivers',
      body: 'Caring for someone is a big job. Caregiver resources can help you look after them and yourself.',
      resourceTopics: ['caregiver'],
      specialties: [],
    });
  }

  return cards;
}
