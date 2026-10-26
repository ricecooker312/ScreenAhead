import { Facts } from '../triage/facts';
import { CareLevel } from '../triage/rules';

export type MedicationInfoStatus =
  | 'not_requested'
  | 'withheld_emergency'
  | 'not_suitable'
  | 'consult_first'
  | 'general_info';

export interface MedicationInfo {
  status: MedicationInfoStatus;
  title: string;
  message: string;
  reasons: string[];
  cautions: string[];
}

/**
 * Educational information about acetaminophen (paracetamol).
 *
 * Never gives a dose and never prescribes. Shown only when the user asked about
 * pain relief, and only as general information when no known safety concern
 * applies. Any uncertainty → "ask a pharmacist or doctor first".
 */
export function assessAcetaminophenInfo(f: Facts, level: CareLevel): MedicationInfo {
  if (!f.desiredHelp.includes('pain_relief_info')) {
    return { status: 'not_requested', title: '', message: '', reasons: [], cautions: [] };
  }

  if (level === 'emergency') {
    return {
      status: 'withheld_emergency',
      title: 'Get help first',
      message: 'Please get emergency help now. Do not take medicine to wait out these symptoms.',
      reasons: ['Emergency warning signs were reported.'],
      cautions: [],
    };
  }

  if (f.acetaminophenAllergy === 'yes') {
    return {
      status: 'not_suitable',
      title: 'Acetaminophen may not be safe for you',
      message:
        'You told us about a reaction to acetaminophen (paracetamol). Do not take it. Ask a pharmacist (a medicine expert at the drugstore) or your doctor about other options.',
      reasons: ['Reported allergy or bad reaction to acetaminophen.'],
      cautions: [],
    };
  }

  const reasons: string[] = [];
  if (f.clinicianPainInstructions) reasons.push('A health professional already gave you pain medicine instructions. Please follow those.');
  if (f.acetaminophenAllergy === 'unknown') reasons.push('We are not sure if you have had a reaction to acetaminophen.');
  if (f.liverDisease) reasons.push('Liver disease can change whether acetaminophen is safe.');
  if (f.heavyAlcohol) reasons.push('Drinking 3 or more alcoholic drinks a day can make acetaminophen harder on the liver.');
  if (f.otherAcetaminophenProducts === 'yes')
    reasons.push('Another medicine you take may already have acetaminophen in it. Taking two could be too much.');
  if (f.otherAcetaminophenProducts === 'unknown') reasons.push('We are not sure if your other medicines have acetaminophen in them.');
  if (f.takingMedications === 'unknown' || f.takingMedications === 'prefer_not')
    reasons.push('We do not know which other medicines you take, so we cannot check for interactions (medicines affecting each other).');
  if (f.safetyFactors.includes('blood_thinner')) reasons.push('Blood thinners can interact with regular acetaminophen use.');
  if (f.age === undefined) reasons.push('We do not know your age. Medicine advice is different for children.');
  else if (f.age < 18) reasons.push('Medicine advice for children and teens is different.');
  if (f.inTreatment) reasons.push('During cancer treatment, acetaminophen can hide a fever. Your treatment team should guide you.');
  if (level === 'insufficient_information') reasons.push('We do not have enough information to share medicine tips safely.');
  if (f.answers.conditions === 'prefer_not') reasons.push('We do not know about your other health conditions.');

  const cautions = [
    'Some pain medicines, like aspirin or ibuprofen, can raise bleeding risk. Ask before using them.',
  ];
  if (level === 'prompt') cautions.unshift('Medicine should not be used to put off getting checked by a doctor.');

  if (reasons.length > 0) {
    return {
      status: 'consult_first',
      title: 'Ask a pharmacist or doctor first',
      message: 'Before taking any pain medicine, please check with a pharmacist (a medicine expert at the drugstore) or your doctor.',
      reasons,
      cautions,
    };
  }

  return {
    status: 'general_info',
    title: 'About acetaminophen (paracetamol)',
    message:
      'Acetaminophen (also called paracetamol) is an over-the-counter (sold without a prescription) medicine some adults use for mild pain. ' +
      'Read and follow the label. Only use one product with acetaminophen at a time. ' +
      'A pharmacist can tell you if it is right for you.',
    reasons: [],
    cautions,
  };
}
