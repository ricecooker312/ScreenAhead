import { Facts } from '../triage/facts';
import { CareLevel } from '../triage/rules';

export interface ComfortOption {
  id: string;
  title: string;
  detail: string;
}

export interface ComfortAssessment {
  show: boolean;
  note?: string;
  options: ComfortOption[];
  excluded: { id: string; reason: string }[];
}

const RISKY_FACTORS = ['recent_surgery', 'fragile_skin', 'reduced_sensation', 'blood_thinner', 'medical_device'];

/**
 * Non-medicine comfort ideas. Heat, cold and massage are shown only when the
 * user has positively confirmed none of the relevant risk factors apply.
 */
export function assessComfort(f: Facts, level: CareLevel): ComfortAssessment {
  if (level === 'emergency') return { show: false, options: [], excluded: [] };

  const options: ComfortOption[] = [
    { id: 'guided_imagery', title: 'Picture a calm place', detail: 'Close your eyes and imagine somewhere peaceful. Notice the colors and sounds.' },
    { id: 'positioning', title: 'Find a comfy position', detail: 'Try lying on your side or sitting propped up. Move slowly.' },
    { id: 'pillows', title: 'Use soft support', detail: 'Pillows under your knees or behind your back can ease pressure.' },
    {
      id: 'support_people',
      title: 'Talk to someone',
      detail: 'A counselor, support group, or cancer helpline can help with worry and stress.',
    },
  ];
  const excluded: ComfortAssessment['excluded'] = [];

  if (f.breathing === 'normal' && !f.symptoms.includes('breathing_problems')) {
    options.push({ id: 'slow_breathing', title: 'Slow, gentle breaths', detail: 'Breathe in for 4 counts and out for 6. Stop if you feel dizzy.' });
  } else {
    excluded.push({ id: 'slow_breathing', reason: 'Breathing exercises are only suggested when breathing feels normal.' });
  }

  const confirmedNoRisk = f.safetyFactors.includes('none') && !f.bleedingRisk;
  const riskFactors = f.safetyFactors.filter((s) => RISKY_FACTORS.includes(s));
  const madeWorse = f.answers.comfort_effect === 'worse' && Array.isArray(f.answers.comfort_measures_used)
    ? (f.answers.comfort_measures_used as string[])
    : [];

  const physical: [string, string, string, string][] = [
    ['warm_pack', 'warm_pack', 'Warm pack', 'A warm (not hot) pack for up to 15–20 minutes, with a cloth between it and your skin.'],
    ['cold_pack', 'cold_pack', 'Cold pack', 'A cold pack wrapped in a towel for up to 15 minutes.'],
    ['gentle_massage', 'massage', 'Gentle massage', 'Light rubbing of sore muscles (not on the belly, scars, or swollen areas).'],
  ];
  for (const [id, answerKey, title, detail] of physical) {
    if (!confirmedNoRisk) {
      excluded.push({
        id,
        reason:
          riskFactors.length > 0 || f.bleedingRisk
            ? 'Heat, cold and massage may not be safe with surgery, fragile skin, numbness, bleeding risk or medical devices. Ask your care team first.'
            : 'We could not confirm heat, cold or massage would be safe for you. Ask your care team first.',
      });
    } else if (madeWorse.includes(answerKey)) {
      excluded.push({ id, reason: 'You said this made things worse.' });
    } else {
      options.push({ id, title, detail });
    }
  }

  return {
    show: true,
    note:
      level === 'prompt' || level === 'insufficient_information'
        ? 'These ideas may help you feel more comfortable while you arrange a check-up. They do not replace one.'
        : 'These ideas may help you feel more comfortable. They do not replace a check-up if symptoms continue or get worse.',
    options,
    excluded,
  };
}
