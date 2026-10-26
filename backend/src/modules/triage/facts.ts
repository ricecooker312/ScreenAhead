import { Answers, UNKNOWN, NA } from '../questionnaire/types';

/** Optional context from the saved health profile. Used only to add caution, never to remove it. */
export interface ProfileContext {
  age?: number;
  allergies?: string[];
  conditions?: string[];
  medicationNames?: string[];
  anyMedicationContainsAcetaminophen?: 'yes' | 'no' | 'unknown';
  alcohol?: string;
  hasCancerHistory?: boolean;
  inTreatment?: boolean;
  hereditarySyndromes?: string[];
  hasFamilyHistory?: boolean;
}

const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

const SAFETY_QUESTIONS = [
  'breathing',
  'severe_abdominal_pain',
  'rectal_bleeding_amount',
  'vomiting_blood',
  'fainting_or_blood_loss_signs',
  'abdominal_swelling',
] as const;

const ACETAMINOPHEN_RE = /acetaminophen|paracetamol|tylenol|apap/i;

/** Normalised view of the answers that rules are written against. */
export interface Facts {
  answers: Answers;
  symptoms: string[];
  hasSymptoms: boolean;
  symptomsAnswered: boolean;
  breathing?: string;
  severeAbdominalPain: boolean;
  bleeding?: string;
  anyRectalBleeding: boolean;
  blackStool: boolean;
  vomitingBlood: boolean;
  faintOrBloodLossSigns: boolean;
  abdominalSwelling?: string;
  repeatedVomiting: boolean;
  cannotPassStoolOrGas: boolean;
  feverDuringTreatment: boolean;
  severity: number | null;
  severityNotApplicable: boolean;
  duration?: string;
  durationPersistent: boolean;
  progression?: string;
  worsening: boolean;
  rapidlyWorsening: boolean;
  abdominalPainPresent: boolean;
  bowelChange: boolean;
  weightLoss: boolean;
  fatigueSevere: boolean;
  pastCancer: boolean;
  inTreatment: boolean;
  familyRisk: boolean;
  familyUnder50: boolean;
  hereditarySyndrome: boolean;
  polyps: boolean;
  ibd: boolean;
  age?: number;
  conditions: string[];
  safetyFactors: string[];
  unsureSafetyAnswers: string[];
  missingSafetyAnswers: string[];
  desiredHelp: string[];
  acetaminophenAllergy: 'yes' | 'no' | 'unknown';
  otherAcetaminophenProducts: 'yes' | 'no' | 'unknown';
  takingMedications?: string;
  clinicianPainInstructions: boolean;
  heavyAlcohol: boolean;
  liverDisease: boolean;
  bleedingRisk: boolean;
}

export function buildFacts(answers: Answers, profile: ProfileContext = {}): Facts {
  const symptoms = arr(answers.symptoms).filter((s) => s !== 'none');
  const blockage = arr(answers.vomiting_or_blockage);
  const stool = arr(answers.stool_appearance);
  const conditionsAns = arr(answers.conditions).filter((c) => c !== 'none');
  const conditions = Array.from(new Set([...conditionsAns, ...(profile.conditions ?? []).map((c) => c.toLowerCase())]));
  const safetyFactors = arr(answers.safety_factors);
  const sev = answers.severity;
  const progression = str(answers.progression);
  const painLocations = arr(answers.pain_location);

  const ageAns = typeof answers.age === 'number' ? answers.age : undefined;
  const allergyText = [str(answers.allergy_list) ?? '', ...(profile.allergies ?? [])].join(' ');

  let acetaminophenAllergy: Facts['acetaminophenAllergy'] = 'no';
  if (answers.acetaminophen_allergy === 'yes' || ACETAMINOPHEN_RE.test(allergyText)) acetaminophenAllergy = 'yes';
  else if (
    answers.acetaminophen_allergy === UNKNOWN ||
    answers.has_allergies === UNKNOWN ||
    answers.has_allergies === 'prefer_not' ||
    (answers.has_allergies === 'yes' && answers.acetaminophen_allergy === undefined)
  )
    acetaminophenAllergy = 'unknown';

  let otherAcetaminophenProducts: Facts['otherAcetaminophenProducts'] = 'no';
  const medText = [str(answers.medication_list) ?? '', ...(profile.medicationNames ?? [])].join(' ');
  if (answers.other_acetaminophen_products === 'yes' || ACETAMINOPHEN_RE.test(medText) || profile.anyMedicationContainsAcetaminophen === 'yes')
    otherAcetaminophenProducts = 'yes';
  else if (
    answers.other_acetaminophen_products === UNKNOWN ||
    profile.anyMedicationContainsAcetaminophen === 'unknown' ||
    (answers.taking_medications === 'yes' && answers.other_acetaminophen_products === undefined)
  )
    otherAcetaminophenProducts = 'unknown';

  const hereditary = str(answers.hereditary_syndrome);

  return {
    answers,
    symptoms,
    hasSymptoms: symptoms.length > 0,
    symptomsAnswered: Array.isArray(answers.symptoms) && answers.symptoms.length > 0,
    breathing: str(answers.breathing),
    severeAbdominalPain: answers.severe_abdominal_pain === 'yes',
    bleeding: str(answers.rectal_bleeding_amount),
    anyRectalBleeding:
      answers.rectal_bleeding_amount === 'small' ||
      answers.rectal_bleeding_amount === 'heavy' ||
      symptoms.includes('rectal_bleeding') ||
      stool.includes('blood'),
    blackStool: symptoms.includes('black_stool') || stool.includes('black_tarry'),
    vomitingBlood: answers.vomiting_blood === 'yes',
    faintOrBloodLossSigns: answers.fainting_or_blood_loss_signs === 'yes',
    abdominalSwelling: str(answers.abdominal_swelling),
    repeatedVomiting: blockage.includes('vomiting'),
    cannotPassStoolOrGas: blockage.includes('no_stool_or_gas'),
    feverDuringTreatment: answers.fever_during_treatment === 'yes',
    severity: typeof sev === 'number' ? sev : null,
    severityNotApplicable: sev === NA,
    duration: str(answers.duration),
    durationPersistent: answers.duration === '3w_3m' || answers.duration === 'gt_3m',
    progression,
    worsening: progression === 'worse' || progression === 'rapidly_worse' || answers.more_frequent === 'yes',
    rapidlyWorsening: progression === 'rapidly_worse',
    abdominalPainPresent:
      symptoms.includes('abdominal_discomfort') ||
      (symptoms.includes('pain') && painLocations.some((l) => ['upper_belly', 'lower_belly', 'side'].includes(l))),
    bowelChange: symptoms.includes('bowel_change') || answers.persistent_bowel_change === 'yes' || stool.includes('narrow'),
    weightLoss: symptoms.includes('weight_loss'),
    fatigueSevere: answers.fatigue_level === 'severe',
    pastCancer: answers.past_cancer === 'yes' || !!profile.hasCancerHistory,
    inTreatment: answers.treatment_status === 'yes' || answers.fever_during_treatment === 'yes' || !!profile.inTreatment,
    familyRisk: answers.family_crc === 'yes' || !!profile.hasFamilyHistory,
    familyUnder50: answers.family_crc_under_50 === 'yes',
    hereditarySyndrome:
      (hereditary !== undefined && ['lynch', 'fap', 'other'].includes(hereditary)) || (profile.hereditarySyndromes?.length ?? 0) > 0,
    polyps: answers.polyps_or_abnormal_screening === 'yes',
    ibd: conditions.includes('ibd'),
    age: ageAns ?? profile.age,
    conditions,
    safetyFactors,
    unsureSafetyAnswers: SAFETY_QUESTIONS.filter((q) => answers[q] === UNKNOWN),
    missingSafetyAnswers: SAFETY_QUESTIONS.filter((q) => answers[q] === undefined || answers[q] === null || answers[q] === ''),
    desiredHelp: arr(answers.desired_help),
    acetaminophenAllergy,
    otherAcetaminophenProducts,
    takingMedications: str(answers.taking_medications),
    clinicianPainInstructions: answers.clinician_pain_instructions === 'yes',
    heavyAlcohol: answers.alcohol === 'three_plus_daily' || profile.alcohol === 'three_plus_daily',
    liverDisease: conditions.includes('liver_disease') || conditions.some((c) => /liver|hepat|cirrhosis/.test(c)),
    bleedingRisk: conditions.includes('bleeding_disorder') || safetyFactors.includes('blood_thinner'),
  };
}
