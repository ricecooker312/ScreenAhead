import { evaluate } from '../../src/modules/triage/engine';
import { buildRecommendations } from '../../src/modules/recommendations/engine';
import { computeIndicators } from '../../src/modules/triage/indicators';
import { buildFacts } from '../../src/modules/triage/facts';
import { SAFE_URGENT, NO_SYMPTOMS, withAnswers } from '../helpers/answers';

/** Adult, routine, asked about pain relief, no known contraindications. */
const PAIN_INFO_OK = withAnswers(SAFE_URGENT, {
  symptoms: ['pain'],
  pain_location: ['back'],
  severity: 3,
  duration: 'lt_1w',
  progression: 'improved',
  age: 40,
  conditions: ['none'],
  safety_factors: ['none'],
  taking_medications: 'no',
  has_allergies: 'no',
  clinician_pain_instructions: 'no',
  alcohol: 'occasional',
  treatment_status: 'no',
  desired_help: ['pain_relief_info', 'comfort_ideas'],
});

describe('acetaminophen information safety', () => {
  it('general info only when asked and no concerns — and never a dose', () => {
    const t = evaluate(PAIN_INFO_OK);
    expect(t.careLevel).toBe('routine');
    expect(t.medication.status).toBe('general_info');
    expect(JSON.stringify(t.medication)).not.toMatch(/\d+\s*(mg|milligram|tablet|pill|g\b)/i);
  });

  it('not shown when the user did not ask about pain relief (low pain score never auto-recommends)', () => {
    const t = evaluate(withAnswers(PAIN_INFO_OK, { severity: 1, desired_help: ['comfort_ideas'] }));
    expect(t.medication.status).toBe('not_requested');
  });

  it('known acetaminophen allergy → not suitable', () => {
    const t = evaluate(withAnswers(PAIN_INFO_OK, { has_allergies: 'yes', acetaminophen_allergy: 'yes' }));
    expect(t.medication.status).toBe('not_suitable');
  });

  it('allergy written in free text or saved profile is detected', () => {
    expect(evaluate(withAnswers(PAIN_INFO_OK, { has_allergies: 'yes', allergy_list: 'Tylenol - hives', acetaminophen_allergy: 'no' })).medication.status).toBe(
      'not_suitable',
    );
    expect(evaluate(PAIN_INFO_OK, { allergies: ['Paracetamol'] }).medication.status).toBe('not_suitable');
  });

  it.each([
    ['liver disease', { conditions: ['liver_disease'] }],
    ['heavy alcohol use', { alcohol: 'three_plus_daily' }],
    ['other acetaminophen product', { taking_medications: 'yes', other_acetaminophen_products: 'yes' }],
    ['unsure about other products', { taking_medications: 'yes', other_acetaminophen_products: 'unknown' }],
    ['existing clinician instructions', { clinician_pain_instructions: 'yes' }],
    ['under 18', { age: 15 }],
    ['age unknown', { age: 'prefer_not' }],
    ['in cancer treatment', { treatment_status: 'yes' }],
    ['blood thinner', { safety_factors: ['blood_thinner'] }],
    ['unsure about allergy', { has_allergies: 'unknown' }],
    ['unknown medicines', { taking_medications: 'unknown' }],
  ])('%s → consult a pharmacist/doctor first', (_n, extra) => {
    const t = evaluate(withAnswers(PAIN_INFO_OK, extra as any));
    expect(t.medication.status).toBe('consult_first');
    expect(t.medication.reasons.length).toBeGreaterThan(0);
  });

  it('medicine is never offered as a way to delay assessment', () => {
    const t = evaluate(withAnswers(PAIN_INFO_OK, { symptoms: ['pain', 'weight_loss'] }));
    expect(t.careLevel).toBe('prompt');
    expect(t.medication.cautions.join(' ')).toMatch(/not be used to put off getting checked/);
  });

  it('insufficient information → consult first', () => {
    const t = evaluate({ symptoms: ['pain'], desired_help: ['pain_relief_info'], age: 40 });
    expect(t.careLevel).toBe('insufficient_information');
    expect(t.medication.status).toBe('consult_first');
  });
});

describe('comfort measures safety', () => {
  it('heat/cold/massage offered only when the user confirmed no risk factors', () => {
    const t = evaluate(PAIN_INFO_OK);
    expect(t.comfort.options.map((o) => o.id)).toEqual(expect.arrayContaining(['warm_pack', 'cold_pack', 'gentle_massage']));
  });

  it.each(['recent_surgery', 'fragile_skin', 'reduced_sensation', 'blood_thinner', 'medical_device'])('%s → no heat/cold/massage', (factor) => {
    const t = evaluate(withAnswers(PAIN_INFO_OK, { safety_factors: [factor] }));
    const ids = t.comfort.options.map((o) => o.id);
    expect(ids).not.toContain('warm_pack');
    expect(ids).not.toContain('gentle_massage');
    expect(t.comfort.excluded.map((e) => e.id)).toContain('warm_pack');
  });

  it('unknown safety factors → no heat/cold/massage', () => {
    const t = evaluate(withAnswers(PAIN_INFO_OK, { safety_factors: 'unknown' }));
    expect(t.comfort.options.map((o) => o.id)).not.toContain('cold_pack');
  });

  it('bleeding disorder blocks massage even if safety factors are "none"', () => {
    const t = evaluate(withAnswers(PAIN_INFO_OK, { conditions: ['bleeding_disorder'] }));
    expect(t.comfort.options.map((o) => o.id)).not.toContain('gentle_massage');
  });

  it('a measure that made things worse is not suggested again', () => {
    const t = evaluate(withAnswers(PAIN_INFO_OK, { comfort_tried: 'yes', comfort_measures_used: ['warm_pack'], comfort_effect: 'worse' }));
    expect(t.comfort.options.map((o) => o.id)).not.toContain('warm_pack');
    expect(t.comfort.options.map((o) => o.id)).toContain('cold_pack');
  });

  it('breathing exercises only when breathing is normal', () => {
    expect(evaluate(PAIN_INFO_OK).comfort.options.map((o) => o.id)).toContain('slow_breathing');
    const t = evaluate(withAnswers(PAIN_INFO_OK, { breathing: 'mild' }));
    expect(t.comfort.options.map((o) => o.id)).not.toContain('slow_breathing');
  });

  it('comfort note says it does not replace a check-up', () => {
    expect(evaluate(PAIN_INFO_OK).comfort.note).toMatch(/do not replace/);
  });
});

describe('recommendation cards', () => {
  it('emergency → a single emergency card', () => {
    const cards = buildRecommendations(evaluate(withAnswers(PAIN_INFO_OK, { breathing: 'severe' })));
    expect(cards).toHaveLength(1);
    expect(cards[0].category).toBe('emergency');
  });

  it('insufficient information → professional contact card, no forced treatment advice', () => {
    const cards = buildRecommendations(evaluate({}));
    expect(cards[0].category).toBe('insufficient_information');
    expect(cards.map((c) => c.category)).not.toContain('medication_info');
  });

  it('nutrition card never claims a diet prevents or cures cancer', () => {
    const cards = buildRecommendations(evaluate(withAnswers(NO_SYMPTOMS, { desired_help: ['nutrition'] })));
    const nutrition = cards.find((c) => c.category === 'nutrition')!;
    expect(nutrition.body).toMatch(/No single diet prevents, treats or cures cancer/);
  });

  it('screening card explains that age alone does not decide', () => {
    const cards = buildRecommendations(evaluate(NO_SYMPTOMS));
    expect(cards.find((c) => c.category === 'screening_risk')!.body).toMatch(/Age alone does not decide/);
  });
});

describe('indicators', () => {
  it('derives 0/1 flags and keeps details separately', () => {
    const f = buildFacts(withAnswers(SAFE_URGENT, { past_cancer: 'yes', past_cancer_type: 'Breast', past_cancer_status: 'remission', diet_concern: 'yes' }));
    const i = computeIndicators(f);
    expect(i.pastCancer).toBe(1);
    expect(i.pastCancerType).toBe('Breast');
    expect(i.dietIssues).toBe(1);
  });

  it('severity null when not applicable', () => {
    const i = computeIndicators(buildFacts({ severity: 'na' }));
    expect(i.severity).toBeNull();
    expect(i.severityNotApplicable).toBe(true);
  });

  it('potentialToWorsen stays within 1–10', () => {
    const worst = computeIndicators(
      buildFacts({
        symptoms: ['rectal_bleeding', 'weight_loss'],
        progression: 'rapidly_worse',
        pattern: 'constant',
        duration: 'gt_3m',
        past_cancer: 'yes',
        family_crc: 'yes',
        treatment_status: 'yes',
      }),
    );
    expect(worst.potentialToWorsen).toBe(10);
    expect(computeIndicators(buildFacts({})).potentialToWorsen).toBe(1);
  });
});
