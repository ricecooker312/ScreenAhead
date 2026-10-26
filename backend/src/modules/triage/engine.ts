import { Answers } from '../questionnaire/types';
import { buildFacts, Facts, ProfileContext } from './facts';
import { ALL_RULES, CareLevel, EMERGENCY_RULES, Rule, RULESET_VERSION, Timeframe } from './rules';
import { computeIndicators, computeSupportOptions, Indicators, SupportOption } from './indicators';
import { assessAcetaminophenInfo, MedicationInfo } from '../recommendations/medication';
import { assessComfort, ComfortAssessment } from '../recommendations/comfort';

export interface Warning {
  ruleId: string;
  level: 'emergency' | 'prompt' | 'info';
  timeframe: Timeframe;
  title: string;
  message: string;
  explanation: string;
}

export interface NextStep {
  id: string;
  title: string;
  detail: string;
  specialty?: string;
}

export interface TriageOutput {
  rulesetVersion: string;
  careLevel: CareLevel;
  timeframe: Timeframe;
  headline: string;
  warnings: Warning[];
  nextSteps: NextStep[];
  indicators: Indicators;
  supportOptions: SupportOption[];
  medication: MedicationInfo;
  comfort: ComfortAssessment;
  explanations: { ruleId: string; text: string }[];
  disclaimers: string[];
}

/**
 * Always shown with results. The app must never imply someone is cancer-free.
 */
export const DISCLAIMERS = [
  'This is not a diagnosis (a doctor’s decision about what is causing your symptoms).',
  'Not having warning signs does not mean you do not have cancer or another illness.',
  'If you feel worse or are worried, contact a doctor. In an emergency, call 911 or your local emergency number.',
];

const toWarning = (r: Rule): Warning => ({
  ruleId: r.id,
  level: r.level,
  timeframe: r.timeframe,
  title: r.title,
  message: r.message,
  explanation: r.explanation,
});

/** Fast check used after every saved answer, so emergencies are shown immediately. */
export function evaluateEmergency(answers: Answers, profile?: ProfileContext): Warning[] {
  const f = buildFacts(answers, profile);
  return EMERGENCY_RULES.filter((r) => r.test(f)).map(toWarning);
}

const TIMEFRAME_ORDER: Timeframe[] = ['now', 'today', 'soon', 'routine', 'unknown'];

function headlineFor(level: CareLevel, timeframe: Timeframe): string {
  switch (level) {
    case 'emergency':
      return 'Please get emergency help now.';
    case 'prompt':
      return timeframe === 'today'
        ? 'Please contact a doctor or nurse today.'
        : 'Talking with a doctor soon would be a good next step.';
    case 'routine':
      return 'Here are some helpful next steps.';
    case 'insufficient_information':
      return 'We need a bit more information to guide you safely.';
  }
}

function buildNextSteps(f: Facts, level: CareLevel, fired: Rule[], support: SupportOption[]): NextStep[] {
  if (level === 'emergency') {
    const steps: NextStep[] = [
      { id: 'call_emergency', title: 'Call 911 or your local emergency number', detail: 'Tell them what you are feeling. Do not drive yourself.' },
    ];
    if (fired.some((r) => r.id === 'E-FEVER-ON-TREATMENT'))
      steps.unshift({ id: 'call_oncology_now', title: 'Call your cancer care team now', detail: 'Use their 24-hour number if you have one.', specialty: 'medical_oncology' });
    return steps;
  }

  const steps: NextStep[] = [];
  const add = (s: NextStep) => {
    if (!steps.some((x) => x.id === s.id)) steps.push(s);
  };

  if (level === 'insufficient_information') {
    add({
      id: 'talk_to_professional',
      title: 'Talk with a doctor or nurse',
      detail: 'Our questions could not give safe advice from the answers we have. A health professional can help.',
      specialty: 'primary_care',
    });
  }

  if (f.pastCancer || f.inTreatment) {
    add({ id: 'contact_oncology_team', title: 'Contact your cancer care team', detail: 'Share these symptoms and questions with them.', specialty: 'medical_oncology' });
  }

  if (level === 'prompt') {
    const today = fired.some((r) => r.timeframe === 'today');
    add({
      id: 'contact_clinician',
      title: today ? 'Contact a doctor today' : 'Book a doctor visit soon',
      detail: 'Your primary care doctor (your main doctor) is a good place to start. They can refer you to a specialist if needed.',
      specialty: 'primary_care',
    });
  } else if (level === 'routine' && f.hasSymptoms) {
    add({ id: 'schedule_primary_care', title: 'Book a check-up', detail: 'Tell your primary care doctor about your symptoms, especially if they last or change.', specialty: 'primary_care' });
  }

  if (support.includes('gastroenterology')) {
    add({
      id: 'gastroenterology',
      title: 'Ask about a gastroenterologist',
      detail: 'A gastroenterologist is a doctor who treats the stomach and bowels.',
      specialty: 'gastroenterology',
    });
  }

  if (support.includes('screening_discussion')) {
    const risk = f.familyRisk || f.polyps || f.hereditarySyndrome || f.ibd;
    add({
      id: 'screening_discussion',
      title: 'Talk about colorectal cancer screening',
      detail: risk
        ? 'Screening means checking for cancer before signs show. Your family or health history may mean starting earlier or testing more often, so ask a doctor.'
        : 'Screening means checking for cancer before signs show. Ask a doctor when and how you should be screened.',
      specialty: 'primary_care',
    });
  }

  if (support.includes('genetic_counseling')) {
    add({
      id: 'genetic_counseling',
      title: 'Consider a genetic counselor',
      detail: 'A genetic counselor helps you understand cancer risks that run in families.',
      specialty: 'genetic_counseling',
    });
  }

  if (support.includes('second_opinion')) {
    add({
      id: 'second_opinion',
      title: 'Get a second opinion',
      detail: 'A second opinion means asking another expert to review your diagnosis or treatment plan. It is common and okay to ask.',
      specialty: 'medical_oncology',
    });
  }

  if (support.includes('nutrition') && (f.inTreatment || f.pastCancer)) {
    add({ id: 'oncology_dietitian', title: 'Ask about an oncology dietitian', detail: 'A food expert who helps people with cancer eat well.', specialty: 'oncology_dietitian' });
  }

  if (support.includes('emotional_support')) {
    add({ id: 'emotional_support', title: 'Find emotional support', detail: 'Counselors and support groups can help with stress and worry.', specialty: 'mental_health' });
  }

  if (support.includes('survivorship')) {
    add({ id: 'survivorship', title: 'Plan your follow-up care', detail: 'Ask your team about a survivorship care plan (a plan for check-ups after treatment).', specialty: 'rehabilitation_survivorship' });
  }

  if (steps.length === 0) {
    add({ id: 'keep_track', title: 'Keep track of how you feel', detail: 'Log any symptoms in the app. Talk to a doctor if anything new happens.' });
  }
  return steps;
}

/**
 * Main entry point. Deterministic: same answers + same ruleset → same output.
 * Emergency rules always take precedence over everything else, including a
 * low self-reported pain score.
 */
export function evaluate(answers: Answers, profile?: ProfileContext): TriageOutput {
  const f = buildFacts(answers, profile);
  const fired = ALL_RULES.filter((r) => r.test(f));
  const emergencies = fired.filter((r) => r.level === 'emergency');
  const prompts = fired.filter((r) => r.level === 'prompt');

  let careLevel: CareLevel;
  let rulesForOutput: Rule[];
  const extraWarnings: Warning[] = [];

  if (emergencies.length > 0) {
    careLevel = 'emergency';
    rulesForOutput = emergencies;
  } else if (prompts.length > 0) {
    careLevel = 'prompt';
    rulesForOutput = prompts;
  } else if (
    f.missingSafetyAnswers.length > 0 ||
    !f.symptomsAnswered ||
    (f.hasSymptoms && (f.duration === undefined || f.duration === 'unknown') && (f.progression === undefined || f.progression === 'unknown'))
  ) {
    careLevel = 'insufficient_information';
    rulesForOutput = [];
    extraWarnings.push({
      ruleId: 'I-INSUFFICIENT',
      level: 'info',
      timeframe: 'unknown',
      title: 'Not enough information',
      message: 'We could not give safe guidance from these answers. Please talk with a doctor or nurse.',
      explanation:
        f.missingSafetyAnswers.length > 0
          ? 'Some safety questions were not answered.'
          : 'We need to know your symptoms and how long they have lasted.',
    });
  } else {
    careLevel = 'routine';
    rulesForOutput = [];
  }

  const timeframe: Timeframe =
    careLevel === 'emergency'
      ? 'now'
      : careLevel === 'prompt'
        ? rulesForOutput.map((r) => r.timeframe).sort((a, b) => TIMEFRAME_ORDER.indexOf(a) - TIMEFRAME_ORDER.indexOf(b))[0]
        : careLevel === 'routine'
          ? 'routine'
          : 'unknown';

  const indicators = computeIndicators(f);
  const supportOptions = computeSupportOptions(f, careLevel, indicators);
  const warnings = [...rulesForOutput.map(toWarning), ...extraWarnings];

  return {
    rulesetVersion: RULESET_VERSION,
    careLevel,
    timeframe,
    headline: headlineFor(careLevel, timeframe),
    warnings,
    nextSteps: buildNextSteps(f, careLevel, rulesForOutput, supportOptions),
    indicators,
    supportOptions,
    medication: assessAcetaminophenInfo(f, careLevel),
    comfort: assessComfort(f, careLevel),
    explanations: warnings.map((w) => ({ ruleId: w.ruleId, text: w.explanation })),
    disclaimers: DISCLAIMERS,
  };
}
