import { pruneHiddenAnswers, visibleSections, allVisibleQuestions } from '../src/questionnaire/shared/branching';
import { QuestionnaireDefinition } from '../src/questionnaire/shared/types';

const def: QuestionnaireDefinition = {
  version: 't',
  sections: [
    {
      id: 'a',
      title: 'A',
      intro: '',
      questions: [
        { id: 'tried', type: 'single', label: 'Tried?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
        { id: 'helped', type: 'single', label: 'Helped?', showIf: { q: 'tried', eq: 'yes' }, options: [{ value: 'yes', label: 'Yes' }] },
      ],
    },
    { id: 'b', title: 'B', intro: '', showIf: { q: 'tried', answered: true }, questions: [{ id: 'x', type: 'text', label: 'X' }] },
  ],
};

describe('client-side branching (shared with the API)', () => {
  it('skips follow-ups when the answer is no', () => {
    expect(allVisibleQuestions(def, { tried: 'no' }).map((q) => q.id)).toEqual(['tried', 'x']);
    expect(allVisibleQuestions(def, { tried: 'yes' }).map((q) => q.id)).toEqual(['tried', 'helped', 'x']);
  });
  it('hides sections until their condition is met', () => {
    expect(visibleSections(def, {}).map((s) => s.id)).toEqual(['a']);
  });
  it('prunes hidden answers', () => {
    expect(pruneHiddenAnswers(def, { tried: 'no', helped: 'yes' })).toEqual({ tried: 'no' });
  });
});
