export type AnswerValue = string | number | boolean | string[] | null;
export type Answers = Record<string, AnswerValue | undefined>;

/** Declarative branching conditions, evaluated identically on server and client. */
export type Condition =
  | { q: string; eq: AnswerValue }
  | { q: string; in: AnswerValue[] }
  | { q: string; includes: string }
  | { q: string; includesAny: string[] }
  | { q: string; gte: number }
  | { q: string; answered: boolean }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export type QuestionType = 'single' | 'multi' | 'scale' | 'text' | 'number' | 'date';

export interface Option {
  value: string;
  label: string;
  /** Selecting this option clears all others in a multi-select (e.g. "None of these"). */
  exclusive?: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  /** Short, plain-language reason we ask. */
  why?: string;
  help?: string;
  options?: Option[];
  min?: number;
  max?: number;
  unit?: string;
  minLabel?: string;
  maxLabel?: string;
  maxLength?: number;
  required?: boolean;
  /** Adds "Not applicable" for scale questions (stored as the string "na"). */
  allowNotApplicable?: boolean;
  /** Adds "I don't know" (stored as "unknown"). */
  allowUnknown?: boolean;
  /** Adds "Prefer not to answer" (stored as "prefer_not"). */
  allowPreferNot?: boolean;
  showIf?: Condition;
  /** Answers to this question are checked for emergency signs as soon as they are saved. */
  safetyCritical?: boolean;
}

export interface Section {
  id: string;
  title: string;
  intro: string;
  questions: Question[];
  showIf?: Condition;
}

export interface QuestionnaireDefinition {
  version: string;
  sections: Section[];
}

export const NA = 'na';
export const UNKNOWN = 'unknown';
export const PREFER_NOT = 'prefer_not';
