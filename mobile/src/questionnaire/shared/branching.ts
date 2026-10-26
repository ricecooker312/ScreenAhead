import { Answers, Condition, Question, QuestionnaireDefinition, Section, NA, UNKNOWN, PREFER_NOT, AnswerValue } from './types';

function isAnswered(v: AnswerValue | undefined): boolean {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function evaluateCondition(cond: Condition | undefined, answers: Answers): boolean {
  if (!cond) return true;
  if ('all' in cond) return cond.all.every((c) => evaluateCondition(c, answers));
  if ('any' in cond) return cond.any.some((c) => evaluateCondition(c, answers));
  if ('not' in cond) return !evaluateCondition(cond.not, answers);

  const v = answers[cond.q];
  if ('answered' in cond) return isAnswered(v) === cond.answered;
  if ('eq' in cond) return v === cond.eq;
  if ('in' in cond) return cond.in.includes(v as AnswerValue);
  if ('includes' in cond) return Array.isArray(v) && v.includes(cond.includes);
  if ('includesAny' in cond) return Array.isArray(v) && cond.includesAny.some((x) => v.includes(x));
  if ('gte' in cond) return typeof v === 'number' && v >= cond.gte;
  return false;
}

export function visibleSections(def: QuestionnaireDefinition, answers: Answers): Section[] {
  return def.sections.filter((s) => evaluateCondition(s.showIf, answers));
}

export function visibleQuestions(section: Section, answers: Answers): Question[] {
  return section.questions.filter((q) => evaluateCondition(q.showIf, answers));
}

export function allVisibleQuestions(def: QuestionnaireDefinition, answers: Answers): Question[] {
  return visibleSections(def, answers).flatMap((s) => visibleQuestions(s, answers));
}

/**
 * Removes answers to questions that are hidden by branching (e.g. the user said
 * "No" to trying comfort measures, so "Did they help?" must not be kept).
 * Repeats until stable because hiding one answer can hide another question.
 */
export function pruneHiddenAnswers(def: QuestionnaireDefinition, answers: Answers): Answers {
  let current = { ...answers };
  for (let i = 0; i < 5; i++) {
    const visibleIds = new Set(allVisibleQuestions(def, current).map((q) => q.id));
    const next: Answers = {};
    for (const [k, v] of Object.entries(current)) if (visibleIds.has(k)) next[k] = v;
    if (Object.keys(next).length === Object.keys(current).length) return next;
    current = next;
  }
  return current;
}

export interface AnswerIssue {
  questionId: string;
  message: string;
}

const SPECIAL = [UNKNOWN, PREFER_NOT];

/** Validates one answer against its question. Returns an error message or null. */
export function validateAnswer(q: Question, v: AnswerValue | undefined): string | null {
  if (!isAnswered(v)) return null;
  if (typeof v === 'string' && SPECIAL.includes(v)) {
    if (v === UNKNOWN && !q.allowUnknown) return '"I don\'t know" is not an option for this question';
    if (v === PREFER_NOT && !q.allowPreferNot) return '"Prefer not to answer" is not an option for this question';
    return null;
  }
  switch (q.type) {
    case 'scale': {
      if (v === NA) return q.allowNotApplicable ? null : '"Not applicable" is not an option for this question';
      if (typeof v !== 'number' || !Number.isInteger(v)) return 'Must be a whole number';
      if (v < (q.min ?? 1) || v > (q.max ?? 10)) return `Must be between ${q.min ?? 1} and ${q.max ?? 10}`;
      return null;
    }
    case 'number': {
      if (typeof v !== 'number' || !Number.isFinite(v)) return 'Must be a number';
      if (q.min !== undefined && v < q.min) return `Must be at least ${q.min}`;
      if (q.max !== undefined && v > q.max) return `Must be at most ${q.max}`;
      return null;
    }
    case 'single': {
      if (typeof v !== 'string' || !q.options?.some((o) => o.value === v)) return 'Not a valid choice';
      return null;
    }
    case 'multi': {
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !q.options?.some((o) => o.value === x)))
        return 'Contains an invalid choice';
      const exclusive = q.options?.filter((o) => o.exclusive).map((o) => o.value) ?? [];
      if (v.length > 1 && v.some((x) => exclusive.includes(x))) return '"None" cannot be combined with other choices';
      return null;
    }
    case 'text': {
      if (typeof v !== 'string') return 'Must be text';
      if (v.length > (q.maxLength ?? 1000)) return `Must be ${q.maxLength ?? 1000} characters or fewer`;
      return null;
    }
    case 'date': {
      if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) return 'Must be a valid date';
      if (Date.parse(v) > Date.now() + 86400000) return 'Date cannot be in the future';
      return null;
    }
    default:
      return 'Unknown question type';
  }
}

/** Validates all answers; unknown question ids are rejected. */
export function validateAnswers(
  def: QuestionnaireDefinition,
  answers: Answers,
  opts: { requireComplete: boolean },
): AnswerIssue[] {
  const issues: AnswerIssue[] = [];
  const byId = new Map(def.sections.flatMap((s) => s.questions).map((q) => [q.id, q]));
  for (const [id, v] of Object.entries(answers)) {
    const q = byId.get(id);
    if (!q) {
      issues.push({ questionId: id, message: 'Unknown question' });
      continue;
    }
    const msg = validateAnswer(q, v);
    if (msg) issues.push({ questionId: id, message: msg });
  }
  if (opts.requireComplete) {
    for (const q of allVisibleQuestions(def, answers)) {
      if (q.required && !isAnswered(answers[q.id])) issues.push({ questionId: q.id, message: 'This question needs an answer' });
    }
  }
  return issues;
}
