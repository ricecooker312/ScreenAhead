# Clinical review required before launch

The triage rules, question wording and safety checks in this repository are a **draft**. They were written against public guidance but have **not** been reviewed by clinicians. That guidance includes:

- NICE NG12 (suspected cancer: recognition and referral),
- American Cancer Society and National Cancer Institute symptom guidance,
- USPSTF colorectal cancer screening (2021),
- CDC guidance on fever and infection during chemotherapy.

Nobody should rely on this app until the review below is complete and signed off.

## Generate the review packet

```bash
cd backend && npm run -s export:clinical > ../clinical-content.json
cd .. && python3 tools/clinical_review.py clinical-content.json --out clinical-review --check-links
```

This produces:

- `review-packet.md`: every rule, safety check, disclaimer, question and source, with sign-off boxes
- `rules.csv`, `questions.csv`, `resources.csv`: spreadsheets with reviewer columns

## What must be reviewed

1. **Emergency rules** (`backend/src/modules/triage/rules.ts`, `EMERGENCY_RULES`): breathing, severe or rapidly worsening abdominal pain, heavy bleeding or blood-loss signs, obstruction pattern, and fever during treatment. Confirm the criteria, the wording, and whether more criteria are needed (e.g. chest pain, confusion, new neurological signs, sepsis signs, severe dehydration).
2. **Prompt rules** (`PROMPT_RULES`): which symptoms trigger "today" versus "soon", and whether to add specific timeframes (e.g. "within 2 weeks").
3. **Thresholds:** severity ≥ 7, "persistent" = 3 weeks or more, weight-loss wording, and the age at which screening is raised (currently 40+ or any risk factor).
4. **Safe fallbacks:** "I don't know" on a safety question leads to prompt (today); missing answers lead to "insufficient information".
5. **Medication information** (`recommendations/medication.ts`): acetaminophen general text, every "consult first" condition, and the absence of dosing. Decide whether to say anything about NSAIDs.
6. **Comfort measures** (`recommendations/comfort.ts`): the exclusion list for heat, cold and massage, and the guided imagery and breathing text.
7. **Question wording** (`modules/questionnaire/definition.ts`): clarity at about a 5th-grade reading level, cultural appropriateness, and whether any question could cause harm or distress.
8. **Educational resources** (`seed/data/resources.ts`): confirm each summary matches its source, check that the links work (they could not be checked from the build environment), then set `reviewedBy` and `lastReviewedAt`.
9. **Emergency number and locale:** `EXPO_PUBLIC_EMERGENCY_NUMBER` and the "911" wording in rule messages must match each launch country.
10. **Glossary** (`mobile/src/content/glossary.ts`): check that the definitions are accurate.

## Change control

- Any change to rules or questions must bump `RULESET_VERSION` (and the questionnaire `version` if questions change).
- Add or adjust tests in `backend/tests/unit/triage.test.ts` for every rule change.
- Keep the signed packet with the release record.
- Consider whether the product meets the definition of software as a medical device (FDA, EU MDR or UKCA) in each market. Get regulatory advice before launch.
