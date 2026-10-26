# Architecture

## Overview

CareCompass is a two-tier system: a React Native client and a stateless REST API backed by MongoDB.

All safety-relevant decisions are made **on the server** by a deterministic, versioned rules engine. The client never decides whether something is an emergency. It only displays what the server returns.

```
┌──────────────────────────── Mobile (Expo / React Native) ────────────────────────────┐
│ Signed out: Welcome → Onboarding → Register/Login · public Learn                      │
│ Patient tabs: Home · Track · Find care · Learn · Me                                   │
│   stack: Questionnaire → Results | Emergency, SymptomForm, Appointments, Provider,    │
│          HealthProfile, CareTeam, MessageThread, Summary, Settings                    │
│ Clinician tabs: Patients · Account   stack: PatientDetail, MessageThread              │
│ api/client.ts: access token in memory, refresh token in Keychain/Keystore             │
└──────────────────────────────────────────┬────────────────────────────────────────────┘
                                           │ HTTPS JSON
┌──────────────────────────────────────────▼────────────────────────────────────────────┐
│ Express 5: helmet → CORS → HTTPS check (prod) → pino (no bodies) → JSON 100kb →        │
│ operator-sanitize → no-store → rate limit → router → requireAuth/requireRole → Zod     │
│                                                                                       │
│ Questionnaire ──► Triage engine (facts → rules → level) ──► Recommendations           │
│   definition        EMERGENCY_RULES / PROMPT_RULES            medication.ts, comfort.ts│
│   branching         indicators.ts (internal only)             engine.ts (cards)       │
└──────────────────────────────────────────┬────────────────────────────────────────────┘
                                           │ Mongoose
                                     ┌─────▼─────┐
                                     │  MongoDB  │
                                     └───────────┘
```

## Key design decisions

| Decision | Why |
|---|---|
| Rules engine is plain TypeScript functions over a normalized `Facts` object | Easy to read, review and test. No hidden weights or formulas. Every rule has an id, message, explanation and timeframe. |
| `RULESET_VERSION` is stored on every TriageResult | Results can be audited against the exact rules that produced them. |
| Emergency rules run on **every saved answer** (`PATCH /questionnaires/:id`) | Emergencies show immediately. The user never has to finish the questionnaire first. |
| The "Quick safety check" section comes first | Emergency signs are asked about before anything else. |
| Raw answers (`Questionnaire.responses`) are separate from derived output (`TriageResult`) | Original answers are never overwritten. Re-evaluating with a new ruleset is possible. |
| Answers hidden by branching are pruned on submit | Stale answers (e.g. "did it help?" after changing to "no") can't influence results. |
| The branching evaluator is shared verbatim with the mobile app | Client and server always agree on which questions are visible. A unit test enforces that the files are identical. |
| Indicators (`severity`, `dietIssues`, `pastCancer`, `potentialToWorsen`) are stored but never shown | They meet the brief's data requirements without displaying unvalidated "risk scores". The dashboard API deliberately leaves them out (and this is tested). |
| "Solvability" is implemented as `supportOptions` | It chooses which resources and referrals to show. It never estimates curability. |
| The saved health profile can only *add* caution | E.g. an allergy in the profile blocks acetaminophen info even if the questionnaire answer says "no". |
| Provider attributes (insurance, languages, telehealth) are hidden unless verified | Prevents unconfirmed claims being shown as fact. |
| Demo providers are fictional, labeled in the API (`label`) and UI, and can't be verified | Meets "do not fabricate providers". |
| Clinician access is patient-initiated (one-time code) and scope-limited | Patients stay in control. Revocation takes effect immediately. Every clinician view is audit-logged. |
| Admins have no endpoint that reads patient health data | Least privilege. |

## Data model (MongoDB collections)

| Collection | Notes |
|---|---|
| `users` | email (unique), Argon2id hash (`select: false`), role, status, onboarding categories, settings, consent records (type/version/time), clinician details and verification, `tokenVersion` for global revocation |
| `refreshtokens` | SHA-256 hash only, rotation family, TTL index on `expiresAt` |
| `passwordresets` | SHA-256 hash, single use, TTL index |
| `healthprofiles` | 1:1 with user; every field optional; length and range validation |
| `questionnaires` | user, version, raw `responses`, `questionsPresented`, status, timestamps; index `{user, createdAt}` |
| `triageresults` | user, questionnaire, `rulesetVersion`, careLevel, timeframe, warnings, nextSteps, indicators, supportOptions, medication, comfort, explanations |
| `symptomentries` | user, type, severity 1–10 (absent = N/A), frequency, change, interventions, notes; index `{user, recordedAt}` |
| `providers` | specialties (enum), location, contact, links, verified-attribute sub-docs, `verification {status, source, lastVerifiedAt, verifiedBy}`, `isDemo`; text and compound indexes |
| `savedproviders` | unique `{user, provider}` |
| `educationalresources` | slug, topics, summary/body, source {name, url, publishedOrReviewed}, `lastReviewedAt`, `reviewedBy`, status; text index |
| `appointments` | user, optional provider ref, startsAt, status, notes, questions, reminder |
| `careconnections` | patient, clinician, status, scopes, hashed one-time code with expiry |
| `messages` | connection, sender, role, kind, body, readAt |
| `auditlogs` | actor, action, target type/id, subject user, IP — **no health content**; TTL retention |

Every growing collection is paginated (`page`, `limit` ≤ 100) and indexed by user and date.

## Authorization model

- **Patient:** reads and writes only their own records. Every query includes `user: req.user.id`, and records owned by someone else return **404**.
- **Clinician:** must be `verified`. Can only see connections where `clinician = self` and `status = active`, filtered by the patient's scopes.
- **Admin:** directory, content and clinician verification, plus audit logs. Cannot read health data.
- Request bodies are validated by strict Zod schemas, so unknown fields like `user` are rejected.

## Extending

- **New cancer types:** add a questionnaire version (`QUESTIONNAIRE_V2`) and rule modules, then route by onboarding category. `getDefinition(version)` already supports multiple versions.
- **Provider networks:** implement `ProviderDirectoryAdapter` (`services/providerDirectory.ts`) and import records as `unverified` until checked.
- **Scheduling and telehealth:** `Provider.bookingUrl` and `Appointment` are the hand-off points. Add a `SchedulingAdapter` when a partner API is available.
- **Internationalization:** all UI copy is in components and the definition. Extract it to i18n files, and use `settings.preferredLanguage`.
