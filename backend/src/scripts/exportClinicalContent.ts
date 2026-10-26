/**
 * Exports everything a clinical reviewer must sign off on — triage rules,
 * questionnaire wording, disclaimers, medication/comfort safety checks and
 * educational sources — as JSON. tools/clinical_review.py turns it into a
 * review packet (Markdown + CSV).
 *
 *   npm run export:clinical > clinical-content.json
 */
import { ALL_RULES, RULESET_VERSION } from '../modules/triage/rules';
import { DISCLAIMERS } from '../modules/triage/engine';
import { QUESTIONNAIRE_V1 } from '../modules/questionnaire/definition';
import { RESOURCES } from '../seed/data/resources';

const out = {
  exportedAt: new Date().toISOString(),
  rulesetVersion: RULESET_VERSION,
  questionnaireVersion: QUESTIONNAIRE_V1.version,
  rules: ALL_RULES.map(({ test: _t, ...r }) => r),
  disclaimers: DISCLAIMERS,
  safetyChecks: {
    medication: [
      'Acetaminophen information is shown only if the user asked about pain relief.',
      'Never shown during an emergency result.',
      'Known/possible acetaminophen allergy (answer, free text, or profile) → "not suitable".',
      'Consult a pharmacist/doctor first if: allergy unknown, liver disease, 3+ alcoholic drinks/day, other acetaminophen products (or unsure), unknown medicines, blood thinner, age unknown or under 18, in cancer treatment, existing clinician instructions, insufficient information, conditions not disclosed.',
      'No dose is ever given. Prompt-level results add: medicine must not be used to put off getting checked.',
    ],
    comfort: [
      'Hidden entirely during an emergency result.',
      'Heat, cold and massage only when the user explicitly answered "none of these" to recent surgery, fragile/radiated skin, numbness, blood thinner, medical device — and has no bleeding disorder.',
      'A measure the user said made things worse is not suggested again.',
      'Breathing exercises only when breathing is reported normal.',
    ],
    insufficientInformation: [
      'Any required safety question unanswered → insufficient information.',
      'Symptoms not answered → insufficient information.',
      'Symptoms present with both duration and progression unknown → insufficient information.',
      '"I don\'t know" on a safety question → prompt (today).',
    ],
  },
  questionnaire: QUESTIONNAIRE_V1,
  resources: RESOURCES.map((r) => ({ slug: r.slug, title: r.title, summary: r.summary, source: r.source })),
};

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
