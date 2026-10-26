import { Answers } from '../../src/modules/questionnaire/types';

/** A complete, calm set of safety answers: no emergency signs. */
export const SAFE_URGENT: Answers = {
  breathing: 'normal',
  severe_abdominal_pain: 'no',
  rectal_bleeding_amount: 'none',
  vomiting_blood: 'no',
  fainting_or_blood_loss_signs: 'no',
  abdominal_swelling: 'no',
  vomiting_or_blockage: ['none'],
  fever_during_treatment: 'not_in_treatment',
};

/** Complete questionnaire for someone with no symptoms who wants screening info. */
export const NO_SYMPTOMS: Answers = {
  ...SAFE_URGENT,
  symptoms: ['none'],
  age: 50,
  desired_help: ['screening_info'],
};

export const withAnswers = (...parts: Answers[]): Answers => Object.assign({}, ...parts);
