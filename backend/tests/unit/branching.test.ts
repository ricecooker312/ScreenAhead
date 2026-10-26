import { QUESTIONNAIRE_V1 } from '../../src/modules/questionnaire/definition';
import {
  allVisibleQuestions,
  evaluateCondition,
  pruneHiddenAnswers,
  validateAnswer,
  validateAnswers,
  visibleSections,
} from '../../src/modules/questionnaire/branching';
import { SAFE_URGENT, NO_SYMPTOMS, withAnswers } from '../helpers/answers';

const ids = (answers: Record<string, unknown>) => allVisibleQuestions(QUESTIONNAIRE_V1, answers as any).map((q) => q.id);
const question = (id: string) => QUESTIONNAIRE_V1.sections.flatMap((s) => s.questions).find((q) => q.id === id)!;

describe('definition integrity', () => {
  it('has unique question ids', () => {
    const all = QUESTIONNAIRE_V1.sections.flatMap((s) => s.questions.map((q) => q.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it('every showIf refers to a question defined earlier', () => {
    const seen = new Set<string>();
    const refs = (c: any): string[] => (c ? (c.q ? [c.q] : [...(c.all ?? []), ...(c.any ?? []), ...(c.not ? [c.not] : [])].flatMap(refs)) : []);
    for (const s of QUESTIONNAIRE_V1.sections) {
      for (const r of refs(s.showIf)) expect(seen.has(r)).toBe(true);
      for (const q of s.questions) {
        for (const r of refs(q.showIf)) expect(seen.has(r)).toBe(true);
        seen.add(q.id);
      }
    }
  });

  it('starts with the safety check section', () => {
    expect(QUESTIONNAIRE_V1.sections[0].id).toBe('urgent_check');
    expect(QUESTIONNAIRE_V1.sections[0].questions.every((q) => q.safetyCritical)).toBe(true);
  });

  it('covers all nine required groups', () => {
    const sectionIds = QUESTIONNAIRE_V1.sections.map((s) => s.id);
    for (const id of ['symptoms', 'severity', 'duration', 'history', 'diet', 'medications', 'risk', 'treatment', 'assistance']) {
      expect(sectionIds).toContain(id);
    }
  });
});

describe('comfort-measure branching', () => {
  it('answering "no" skips which-measures and effectiveness questions', () => {
    const v = ids(withAnswers(SAFE_URGENT, { symptoms: ['pain'], comfort_tried: 'no' }));
    expect(v).not.toContain('comfort_measures_used');
    expect(v).not.toContain('comfort_effect');
  });

  it('answering "yes" asks which measures and whether they helped', () => {
    const v = ids(withAnswers(SAFE_URGENT, { symptoms: ['pain'], comfort_tried: 'yes' }));
    expect(v).toContain('comfort_measures_used');
    expect(v).toContain('comfort_effect');
  });

  it('changing "yes" to "no" prunes the old effectiveness answers', () => {
    const pruned = pruneHiddenAnswers(
      QUESTIONNAIRE_V1,
      withAnswers(SAFE_URGENT, { symptoms: ['pain'], comfort_tried: 'no', comfort_measures_used: ['warm_pack'], comfort_effect: 'helped' }),
    );
    expect(pruned.comfort_measures_used).toBeUndefined();
    expect(pruned.comfort_effect).toBeUndefined();
    expect(pruned.comfort_tried).toBe('no');
  });
});

describe('other branching', () => {
  it('"no symptoms" hides severity and duration sections', () => {
    const sections = visibleSections(QUESTIONNAIRE_V1, NO_SYMPTOMS).map((s) => s.id);
    expect(sections).not.toContain('severity');
    expect(sections).not.toContain('duration');
  });

  it('pain shows location question; other symptom shows free text', () => {
    expect(ids({ symptoms: ['pain'] })).toContain('pain_location');
    expect(ids({ symptoms: ['fatigue'] })).not.toContain('pain_location');
    expect(ids({ symptoms: ['other'] })).toContain('other_symptoms');
  });

  it('cancer type/status only asked after "yes" to past cancer', () => {
    expect(ids({ past_cancer: 'no' })).not.toContain('past_cancer_type');
    expect(ids({ past_cancer: 'yes' })).toEqual(expect.arrayContaining(['past_cancer_type', 'past_cancer_status']));
  });

  it('acetaminophen follow-ups depend on medication and allergy answers', () => {
    expect(ids({ taking_medications: 'no' })).not.toContain('other_acetaminophen_products');
    expect(ids({ taking_medications: 'yes' })).toContain('other_acetaminophen_products');
    expect(ids({ has_allergies: 'yes' })).toContain('acetaminophen_allergy');
  });

  it('condition operators behave', () => {
    expect(evaluateCondition({ q: 'a', gte: 5 }, { a: 7 })).toBe(true);
    expect(evaluateCondition({ q: 'a', gte: 5 }, { a: 'x' })).toBe(false);
    expect(evaluateCondition({ any: [{ q: 'a', eq: 1 }, { q: 'b', eq: 2 }] }, { b: 2 })).toBe(true);
    expect(evaluateCondition({ not: { q: 'a', answered: true } }, {})).toBe(true);
  });
});

describe('severity validation', () => {
  const sev = question('severity');
  it.each([1, 5, 10])('accepts %p', (v) => expect(validateAnswer(sev, v)).toBeNull());
  it.each([0, 11, -3, 4.5, '7'])('rejects %p', (v) => expect(validateAnswer(sev, v as any)).not.toBeNull());
  it('accepts "not applicable"', () => expect(validateAnswer(sev, 'na')).toBeNull());
});

describe('answer validation', () => {
  it('rejects unknown question ids', () => {
    expect(validateAnswers(QUESTIONNAIRE_V1, { hacker: 'x' }, { requireComplete: false })[0].message).toBe('Unknown question');
  });

  it('rejects options that do not exist', () => {
    expect(validateAnswer(question('breathing'), 'fine')).not.toBeNull();
  });

  it('rejects "none" combined with other choices', () => {
    expect(validateAnswer(question('symptoms'), ['none', 'pain'])).not.toBeNull();
  });

  it('only allows "I don\'t know" / "Prefer not" where offered', () => {
    expect(validateAnswer(question('breathing'), 'unknown')).toBeNull();
    expect(validateAnswer(question('vomiting_blood'), 'unknown')).not.toBeNull();
    expect(validateAnswer(question('age'), 'prefer_not')).toBeNull();
  });

  it('rejects future dates and over-long text', () => {
    expect(validateAnswer(question('symptom_start_date'), '2999-01-01')).not.toBeNull();
    expect(validateAnswer(question('other_symptoms'), 'x'.repeat(501))).not.toBeNull();
  });

  it('reports missing required answers when completing', () => {
    const issues = validateAnswers(QUESTIONNAIRE_V1, { breathing: 'normal' }, { requireComplete: true });
    const missing = issues.map((i) => i.questionId);
    expect(missing).toEqual(expect.arrayContaining(['severe_abdominal_pain', 'symptoms', 'desired_help']));
  });

  it('a complete no-symptom questionnaire is valid', () => {
    expect(validateAnswers(QUESTIONNAIRE_V1, NO_SYMPTOMS, { requireComplete: true })).toEqual([]);
  });
});
