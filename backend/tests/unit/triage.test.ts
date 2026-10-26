import { evaluate, evaluateEmergency, DISCLAIMERS } from '../../src/modules/triage/engine';
import { RULESET_VERSION } from '../../src/modules/triage/rules';
import { SAFE_URGENT, NO_SYMPTOMS, withAnswers } from '../helpers/answers';

describe('emergency rules', () => {
  const emergencyCases: [string, Record<string, unknown>][] = [
    ['severe breathing difficulty', { breathing: 'severe' }],
    ['abnormally slow breathing', { breathing: 'slow' }],
    ['severe abdominal pain', { severe_abdominal_pain: 'yes' }],
    ['heavy rectal bleeding', { rectal_bleeding_amount: 'heavy' }],
    ['vomiting blood', { vomiting_blood: 'yes' }],
    ['fainting / blood-loss signs', { fainting_or_blood_loss_signs: 'yes' }],
    ['severe swelling with vomiting', { abdominal_swelling: 'severe', vomiting_or_blockage: ['vomiting'] }],
    ['severe swelling and cannot pass stool or gas', { abdominal_swelling: 'severe', vomiting_or_blockage: ['no_stool_or_gas'] }],
    ['fever during cancer treatment', { fever_during_treatment: 'yes' }],
  ];

  it.each(emergencyCases)('%s → emergency', (_name, extra) => {
    const t = evaluate(withAnswers(NO_SYMPTOMS, extra as any));
    expect(t.careLevel).toBe('emergency');
    expect(t.timeframe).toBe('now');
    expect(t.nextSteps.some((s) => s.id === 'call_emergency')).toBe(true);
  });

  it('rapidly worsening abdominal pain → emergency', () => {
    const t = evaluate(
      withAnswers(SAFE_URGENT, { symptoms: ['abdominal_discomfort'], severity: 4, duration: 'lt_1w', progression: 'rapidly_worse', desired_help: ['understand_next_steps'] }),
    );
    expect(t.careLevel).toBe('emergency');
    expect(t.warnings.map((w) => w.ruleId)).toContain('E-ABDOMINAL-PAIN');
  });

  it('severe warning signs take precedence over a LOW self-reported pain score', () => {
    const t = evaluate(
      withAnswers(SAFE_URGENT, {
        rectal_bleeding_amount: 'heavy',
        symptoms: ['rectal_bleeding'],
        severity: 1,
        duration: 'lt_1w',
        progression: 'same',
        desired_help: ['pain_relief_info'],
      }),
    );
    expect(t.careLevel).toBe('emergency');
    expect(t.medication.status).toBe('withheld_emergency');
    expect(t.comfort.show).toBe(false);
  });

  it('breathing emergency wins even when severity is "not applicable"', () => {
    const t = evaluate(withAnswers(NO_SYMPTOMS, { breathing: 'slow', severity: 'na' }));
    expect(t.careLevel).toBe('emergency');
  });

  it('swelling alone (no vomiting/blockage) is not the obstruction emergency', () => {
    const t = evaluate(withAnswers(NO_SYMPTOMS, { abdominal_swelling: 'severe' }));
    expect(t.warnings.map((w) => w.ruleId)).not.toContain('E-OBSTRUCTION');
  });

  it('evaluateEmergency works on partial answers (first question only)', () => {
    expect(evaluateEmergency({ breathing: 'severe' })).toHaveLength(1);
    expect(evaluateEmergency({ breathing: 'normal' })).toHaveLength(0);
  });

  it('emergency output contains only emergency warnings and steps', () => {
    const t = evaluate(withAnswers(NO_SYMPTOMS, { vomiting_blood: 'yes', symptoms: ['weight_loss'], duration: 'gt_3m', progression: 'worse' }));
    expect(t.warnings.every((w) => w.level === 'emergency')).toBe(true);
    expect(t.supportOptions).toEqual(['emergency_care']);
  });
});

describe('prompt medical assessment rules', () => {
  const base = withAnswers(SAFE_URGENT, { duration: '3w_3m', progression: 'same', desired_help: ['understand_next_steps'] });

  it.each([
    ['small rectal bleeding', { rectal_bleeding_amount: 'small', symptoms: ['rectal_bleeding'] }, 'P-RECTAL-BLEEDING'],
    ['persistent bowel change', { symptoms: ['bowel_change'] }, 'P-BOWEL-CHANGE'],
    ['unexplained weight loss', { symptoms: ['weight_loss'] }, 'P-WEIGHT-LOSS'],
    ['persistent abdominal discomfort', { symptoms: ['abdominal_discomfort'] }, 'P-ABDOMINAL-PERSISTENT'],
    ['new symptoms with cancer history', { symptoms: ['fatigue'], past_cancer: 'yes' }, 'P-CANCER-HISTORY-NEW-SYMPTOMS'],
    ['symptoms with hereditary risk', { symptoms: ['bowel_change'], hereditary_syndrome: 'lynch' }, 'P-HEREDITARY-RISK-SYMPTOMS'],
    ['black stool', { symptoms: ['black_stool'] }, 'P-BLACK-STOOL'],
    ['mild breathlessness', { breathing: 'mild', symptoms: ['fatigue'] }, 'P-BREATHING-MILD'],
  ])('%s → prompt (%s)', (_name, extra, ruleId) => {
    const t = evaluate(withAnswers(base, extra as any));
    expect(t.careLevel).toBe('prompt');
    expect(t.warnings.map((w) => w.ruleId)).toContain(ruleId);
  });

  it('black stool and vomiting are "today", bleeding alone is "soon"', () => {
    expect(evaluate(withAnswers(base, { symptoms: ['black_stool'] })).timeframe).toBe('today');
    expect(evaluate(withAnswers(base, { symptoms: ['rectal_bleeding'], rectal_bleeding_amount: 'small' })).timeframe).toBe('soon');
  });

  it('"I don\'t know" on a safety question → prompt today (safe fallback)', () => {
    const t = evaluate(withAnswers(NO_SYMPTOMS, { fainting_or_blood_loss_signs: 'unknown' }));
    expect(t.careLevel).toBe('prompt');
    expect(t.timeframe).toBe('today');
  });

  it('high severity that is getting worse → today', () => {
    const t = evaluate(withAnswers(base, { symptoms: ['pain'], pain_location: ['back'], severity: 8, progression: 'worse' }));
    expect(t.careLevel).toBe('prompt');
    expect(t.timeframe).toBe('today');
  });

  it('a low pain score never lowers the level when a prompt sign is present', () => {
    const t = evaluate(withAnswers(base, { symptoms: ['weight_loss'], severity: 1 }));
    expect(t.careLevel).toBe('prompt');
  });
});

describe('routine and insufficient information', () => {
  it('no symptoms, all safety answers → routine with screening discussion', () => {
    const t = evaluate(NO_SYMPTOMS);
    expect(t.careLevel).toBe('routine');
    expect(t.nextSteps.map((s) => s.id)).toContain('screening_discussion');
  });

  it('screening advice is not inferred from age alone: family history changes the wording', () => {
    const plain = evaluate(NO_SYMPTOMS).nextSteps.find((s) => s.id === 'screening_discussion')!;
    const family = evaluate(withAnswers(NO_SYMPTOMS, { family_crc: 'yes' })).nextSteps.find((s) => s.id === 'screening_discussion')!;
    expect(family.detail).toMatch(/earlier|more often/);
    expect(plain.detail).not.toMatch(/earlier/);
  });

  it('young person with family risk still gets screening discussion + genetic counselling', () => {
    const t = evaluate(withAnswers(NO_SYMPTOMS, { age: 30, family_crc: 'yes', family_crc_under_50: 'yes', desired_help: ['understand_next_steps'] }));
    expect(t.supportOptions).toEqual(expect.arrayContaining(['screening_discussion', 'genetic_counseling']));
  });

  it('missing safety answers → insufficient information', () => {
    const t = evaluate({ symptoms: ['none'], desired_help: ['screening_info'] });
    expect(t.careLevel).toBe('insufficient_information');
    expect(t.nextSteps[0].id).toBe('talk_to_professional');
  });

  it('empty answers → insufficient information (never a reassuring result)', () => {
    const t = evaluate({});
    expect(t.careLevel).toBe('insufficient_information');
  });

  it('symptoms with unknown duration AND unknown progression → insufficient information', () => {
    const t = evaluate(withAnswers(SAFE_URGENT, { symptoms: ['fatigue'], duration: 'unknown', progression: 'unknown', desired_help: ['understand_next_steps'] }));
    expect(t.careLevel).toBe('insufficient_information');
  });

  it('mild short-lived symptom → routine with a check-up step, not dismissal', () => {
    const t = evaluate(
      withAnswers(SAFE_URGENT, { symptoms: ['fatigue'], fatigue_level: 'mild', severity: 2, duration: 'lt_1w', progression: 'improved', desired_help: ['understand_next_steps'] }),
    );
    expect(t.careLevel).toBe('routine');
    expect(t.nextSteps.map((s) => s.id)).toContain('schedule_primary_care');
  });
});

describe('language safety', () => {
  const allOutputs = [
    evaluate(NO_SYMPTOMS),
    evaluate({}),
    evaluate(withAnswers(SAFE_URGENT, { symptoms: ['fatigue'], severity: 2, duration: 'lt_1w', progression: 'improved', desired_help: ['comfort_ideas'] })),
    evaluate(withAnswers(NO_SYMPTOMS, { breathing: 'severe' })),
  ];

  it('always includes the disclaimers, including "no warning signs ≠ no cancer"', () => {
    for (const t of allOutputs) {
      expect(t.disclaimers).toEqual(DISCLAIMERS);
      expect(t.disclaimers.join(' ')).toMatch(/does not mean you do not have cancer/);
    }
  });

  it('never tells the user they are cancer-free or that symptoms are harmless', () => {
    const forbidden = /cancer[- ]free|you do not have cancer|you don't have cancer|nothing to worry|harmless|no need to see/i;
    for (const t of allOutputs) {
      const text = JSON.stringify({ ...t, disclaimers: [] });
      expect(text).not.toMatch(forbidden);
    }
  });

  it('records the ruleset version', () => {
    expect(evaluate(NO_SYMPTOMS).rulesetVersion).toBe(RULESET_VERSION);
  });

  it('is deterministic', () => {
    const a = withAnswers(SAFE_URGENT, { symptoms: ['bowel_change'], duration: 'gt_3m', progression: 'worse', desired_help: ['find_specialist'] });
    expect(evaluate(a)).toEqual(evaluate(a));
  });
});

describe('profile context adds caution only', () => {
  it('cancer history from the saved profile triggers the oncology-team rule', () => {
    const answers = withAnswers(SAFE_URGENT, { symptoms: ['fatigue'], duration: '1_3w', progression: 'same', desired_help: ['understand_next_steps'] });
    expect(evaluate(answers).careLevel).toBe('routine');
    const t = evaluate(answers, { hasCancerHistory: true });
    expect(t.careLevel).toBe('prompt');
    expect(t.nextSteps.map((s) => s.id)).toContain('contact_oncology_team');
  });
});
