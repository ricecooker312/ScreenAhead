import { Facts } from './facts';
import { CareLevel } from './rules';

/**
 * Derived indicators, stored separately from the original answers.
 *
 * None of these is a medical prediction. They are internal bookkeeping values
 * used to pick which resources and next steps to show. They are never shown to
 * users as a "risk score".
 */
export interface Indicators {
  /** 1–10 self-reported intensity, or null when not given / not applicable. */
  severity: number | null;
  severityNotApplicable: boolean;
  /** 0 = no dietary concern reported, 1 = concern reported. Details stay in the answers. */
  dietIssues: 0 | 1;
  /** 0 = no known personal cancer history, 1 = previous or current cancer reported. */
  pastCancer: 0 | 1;
  pastCancerType?: string;
  pastCancerStatus?: string;
  /**
   * 1–10 "symptom-progression concern" score from simple, documented rules.
   * NOT a validated prediction of cancer or of disease progression.
   */
  potentialToWorsen: number;
  potentialToWorsenFactors: string[];
}

export function computeIndicators(f: Facts): Indicators {
  const a = f.answers;
  const factors: string[] = [];
  let score = 1;
  const add = (n: number, why: string) => {
    score += n;
    factors.push(why);
  };
  if (f.hasSymptoms) {
    if (f.rapidlyWorsening) add(3, 'symptoms getting worse quickly');
    else if (f.worsening) add(2, 'symptoms getting worse or more frequent');
    if (a.pattern === 'constant') add(1, 'symptoms are constant');
    if (f.durationPersistent) add(2, 'symptoms present for 3 weeks or more');
    if (f.anyRectalBleeding || f.blackStool || f.weightLoss || f.bowelChange) add(2, 'symptom that should be checked by a doctor');
  }
  if (f.pastCancer) add(1, 'personal history of cancer');
  if (f.familyRisk || f.hereditarySyndrome) add(1, 'family or inherited risk');
  if (f.inTreatment) add(1, 'currently in cancer treatment');

  const dietIssues: 0 | 1 = a.diet_concern === 'yes' || a.eating_changed === 'hard_to_eat' || a.eating_changed === 'less_appetite' ? 1 : 0;

  return {
    severity: f.severity,
    severityNotApplicable: f.severityNotApplicable,
    dietIssues,
    pastCancer: f.pastCancer ? 1 : 0,
    pastCancerType: typeof a.past_cancer_type === 'string' ? a.past_cancer_type : undefined,
    pastCancerStatus: typeof a.past_cancer_status === 'string' ? a.past_cancer_status : undefined,
    potentialToWorsen: Math.max(1, Math.min(10, score)),
    potentialToWorsenFactors: factors,
  };
}

/**
 * "Solvability" in the product brief: which kinds of support may be relevant.
 * This never estimates whether cancer is curable. It only selects resources,
 * navigation options and referrals to display, after safety rules are applied.
 */
export type SupportOption =
  | 'emergency_care'
  | 'professional_assessment'
  | 'oncology_team'
  | 'gastroenterology'
  | 'primary_care'
  | 'screening_discussion'
  | 'genetic_counseling'
  | 'medication_info'
  | 'comfort_measures'
  | 'emotional_support'
  | 'nutrition'
  | 'survivorship'
  | 'caregiver_support'
  | 'second_opinion';

export function computeSupportOptions(f: Facts, level: CareLevel, indicators: Indicators): SupportOption[] {
  if (level === 'emergency') return ['emergency_care'];
  const s = new Set<SupportOption>();
  const want = (k: string) => f.desiredHelp.includes(k);

  if (level === 'prompt' || level === 'insufficient_information' || f.hasSymptoms) s.add('professional_assessment');
  if (f.pastCancer || f.inTreatment) s.add('oncology_team');
  if (f.anyRectalBleeding || f.bowelChange || f.blackStool || f.abdominalPainPresent) s.add('gastroenterology');
  if (f.hasSymptoms || want('find_specialist')) s.add('primary_care');
  if (want('screening_info') || f.familyRisk || f.polyps || f.hereditarySyndrome || (f.age !== undefined && f.age >= 40))
    s.add('screening_discussion');
  if (f.hereditarySyndrome || f.familyUnder50) s.add('genetic_counseling');
  if (want('pain_relief_info')) s.add('medication_info');
  if (want('comfort_ideas') || (f.severity !== null && f.severity > 0)) s.add('comfort_measures');
  if (want('emotional_support') || f.pastCancer || f.inTreatment) s.add('emotional_support');
  if (want('nutrition') || indicators.dietIssues === 1) s.add('nutrition');
  if (want('survivorship') || f.answers.treatment_status === 'finished' || f.answers.past_cancer_status === 'remission')
    s.add('survivorship');
  if (want('caregiver')) s.add('caregiver_support');
  if (want('second_opinion')) s.add('second_opinion');
  return Array.from(s);
}
