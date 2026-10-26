import { Facts } from './facts';

/**
 * Deterministic safety rules.
 *
 * STATUS: DRAFT — written against public guidance (e.g. NHS/NICE NG12 suspected
 * cancer recognition, American Cancer Society and NCI symptom guidance, CDC
 * neutropenic-fever guidance). Every rule, threshold and message MUST be reviewed
 * and signed off by qualified clinicians before production use. Bump
 * RULESET_VERSION on every change; each TriageResult stores the version used.
 */
export const RULESET_VERSION = '2026.10-draft.1';

export type CareLevel = 'emergency' | 'prompt' | 'routine' | 'insufficient_information';
export type Timeframe = 'now' | 'today' | 'soon' | 'routine' | 'unknown';

export interface Rule {
  id: string;
  level: 'emergency' | 'prompt';
  timeframe: Timeframe;
  title: string;
  /** Plain-language message shown to the user. */
  message: string;
  /** Why the rule fired, shown under "Why am I seeing this?" */
  explanation: string;
  /** Suggested type of professional, if any. */
  specialty?: string;
  test: (f: Facts) => boolean;
}

const EMERGENCY_MESSAGE = 'Call 911 or your local emergency number now. Do not drive yourself.';

export const EMERGENCY_RULES: Rule[] = [
  {
    id: 'E-BREATHING',
    level: 'emergency',
    timeframe: 'now',
    title: 'Breathing problem',
    message: EMERGENCY_MESSAGE,
    explanation: 'You said breathing is very hard or very slow. That needs emergency help right away.',
    test: (f) => f.breathing === 'severe' || f.breathing === 'slow',
  },
  {
    id: 'E-ABDOMINAL-PAIN',
    level: 'emergency',
    timeframe: 'now',
    title: 'Severe belly pain',
    message: EMERGENCY_MESSAGE,
    explanation: 'You said your belly pain is very bad or getting worse fast.',
    test: (f) => f.severeAbdominalPain || (f.abdominalPainPresent && f.rapidlyWorsening),
  },
  {
    id: 'E-BLEEDING',
    level: 'emergency',
    timeframe: 'now',
    title: 'Heavy bleeding or signs of blood loss',
    message: EMERGENCY_MESSAGE,
    explanation:
      'You told us about heavy bleeding, throwing up blood, fainting, or feeling very dizzy or weak. These can be signs of losing a lot of blood.',
    test: (f) => f.bleeding === 'heavy' || f.vomitingBlood || f.faintOrBloodLossSigns,
  },
  {
    id: 'E-OBSTRUCTION',
    level: 'emergency',
    timeframe: 'now',
    title: 'Very swollen belly with throwing up or blockage',
    message: EMERGENCY_MESSAGE,
    explanation:
      'A very swollen belly with throwing up, or not being able to poop or pass gas, can mean the bowel is blocked (an obstruction).',
    test: (f) => f.abdominalSwelling === 'severe' && (f.repeatedVomiting || f.cannotPassStoolOrGas),
  },
  {
    id: 'E-FEVER-ON-TREATMENT',
    level: 'emergency',
    timeframe: 'now',
    title: 'Fever during cancer treatment',
    message:
      'Call your cancer care team’s 24-hour number right now. If you cannot reach them, call 911 or go to the emergency room.',
    explanation:
      'Some cancer treatments lower the cells that fight germs. A fever can mean a serious infection that needs care right away.',
    specialty: 'medical_oncology',
    test: (f) => f.feverDuringTreatment,
  },
];

export const PROMPT_RULES: Rule[] = [
  {
    id: 'P-BLACK-STOOL',
    level: 'prompt',
    timeframe: 'today',
    title: 'Black, tar-like poop',
    message: 'Please contact a doctor today. If you also feel faint or weak, call 911.',
    explanation: 'Black, sticky poop can be a sign of bleeding higher up in the gut.',
    specialty: 'gastroenterology',
    test: (f) => f.blackStool,
  },
  {
    id: 'P-VOMITING-OR-BLOCKAGE',
    level: 'prompt',
    timeframe: 'today',
    title: 'Throwing up or trouble passing poop or gas',
    message: 'Please contact a doctor today. If your belly gets very swollen or the pain gets bad, call 911.',
    explanation: 'Throwing up again and again, or not passing poop or gas, should be checked soon.',
    test: (f) => f.repeatedVomiting || f.cannotPassStoolOrGas,
  },
  {
    id: 'P-BREATHING-MILD',
    level: 'prompt',
    timeframe: 'today',
    title: 'Shortness of breath',
    message: 'Please contact a doctor today. If breathing gets hard, call 911.',
    explanation: 'You said you get short of breath. New breathing changes should be checked.',
    test: (f) => f.breathing === 'mild' || f.symptoms.includes('breathing_problems'),
  },
  {
    id: 'P-STRONG-WORSENING-SYMPTOM',
    level: 'prompt',
    timeframe: 'today',
    title: 'Strong symptom that is getting worse',
    message: 'Please contact a doctor today.',
    explanation: 'You rated your symptom 7 or higher and said it is getting worse.',
    test: (f) => f.severity !== null && f.severity >= 7 && f.worsening,
  },
  {
    id: 'P-UNSURE-SAFETY',
    level: 'prompt',
    timeframe: 'today',
    title: 'Some safety answers were unsure',
    message: 'When you are not sure, it is safest to talk to a doctor or nurse today. If you feel very unwell, call 911.',
    explanation: 'You answered “I don’t know” to one or more safety questions.',
    test: (f) => f.unsureSafetyAnswers.length > 0,
  },
  {
    id: 'P-RECTAL-BLEEDING',
    level: 'prompt',
    timeframe: 'soon',
    title: 'Blood in poop',
    message: 'Please make an appointment with a doctor soon to talk about this bleeding.',
    explanation:
      'New or ongoing bleeding from the bottom has many causes, and most are not cancer. A doctor should still check it.',
    specialty: 'gastroenterology',
    test: (f) => f.anyRectalBleeding,
  },
  {
    id: 'P-BOWEL-CHANGE',
    level: 'prompt',
    timeframe: 'soon',
    title: 'Change in bowel habits',
    message: 'Please make an appointment with a doctor soon.',
    explanation: 'A change in how often you poop, or how it looks, that keeps going should be checked.',
    specialty: 'gastroenterology',
    test: (f) => f.bowelChange,
  },
  {
    id: 'P-WEIGHT-LOSS',
    level: 'prompt',
    timeframe: 'soon',
    title: 'Weight loss without trying',
    message: 'Please make an appointment with a doctor soon.',
    explanation: 'Losing weight without trying should be checked by a doctor.',
    specialty: 'primary_care',
    test: (f) => f.weightLoss,
  },
  {
    id: 'P-ABDOMINAL-PERSISTENT',
    level: 'prompt',
    timeframe: 'soon',
    title: 'Belly discomfort that keeps going or gets worse',
    message: 'Please make an appointment with a doctor soon.',
    explanation: 'Belly pain or bloating that lasts for weeks, or gets worse, should be checked.',
    specialty: 'gastroenterology',
    test: (f) => f.abdominalPainPresent && (f.durationPersistent || f.worsening),
  },
  {
    id: 'P-STRONG-SYMPTOM',
    level: 'prompt',
    timeframe: 'soon',
    title: 'Strong symptom',
    message: 'Please contact a doctor soon. Strong pain or symptoms deserve a check.',
    explanation: 'You rated your symptom 7 or higher out of 10.',
    test: (f) => f.severity !== null && f.severity >= 7,
  },
  {
    id: 'P-SEVERE-FATIGUE',
    level: 'prompt',
    timeframe: 'soon',
    title: 'Very tired',
    message: 'Please make an appointment with a doctor soon.',
    explanation: 'Tiredness that keeps you in bed should be checked.',
    test: (f) => f.fatigueSevere,
  },
  {
    id: 'P-SYMPTOMS-WORSENING',
    level: 'prompt',
    timeframe: 'soon',
    title: 'Symptoms getting worse',
    message: 'Please contact a doctor soon.',
    explanation: 'You said your symptoms are getting worse or happening more often.',
    test: (f) => f.hasSymptoms && f.worsening,
  },
  {
    id: 'P-CANCER-HISTORY-NEW-SYMPTOMS',
    level: 'prompt',
    timeframe: 'soon',
    title: 'New symptoms after cancer',
    message: 'Please tell your cancer care team or doctor about these symptoms soon.',
    explanation: 'You have had cancer before. New symptoms should be shared with your care team.',
    specialty: 'medical_oncology',
    test: (f) => f.pastCancer && f.hasSymptoms,
  },
  {
    id: 'P-IN-TREATMENT-SYMPTOMS',
    level: 'prompt',
    timeframe: 'soon',
    title: 'Symptoms during treatment',
    message: 'Please tell your treatment team about new or changing symptoms. Many teams want to hear quickly.',
    explanation: 'You are getting cancer treatment. Your team can tell you if a symptom is expected or needs care.',
    specialty: 'medical_oncology',
    test: (f) => f.inTreatment && f.hasSymptoms,
  },
  {
    id: 'P-HEREDITARY-RISK-SYMPTOMS',
    level: 'prompt',
    timeframe: 'soon',
    title: 'Symptoms with family or inherited risk',
    message: 'Please make an appointment with a doctor soon and tell them about your family history.',
    explanation: 'Your family history or an inherited condition can raise risk, so symptoms are worth checking.',
    specialty: 'gastroenterology',
    test: (f) =>
      (f.familyRisk || f.hereditarySyndrome || f.polyps) &&
      (f.anyRectalBleeding || f.bowelChange || f.weightLoss || f.abdominalPainPresent),
  },
];

export const ALL_RULES = [...EMERGENCY_RULES, ...PROMPT_RULES];
