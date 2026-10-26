# External services and integrations

Everything below is either **not connected** or runs in a safe local mode. Each one has an interface in the code and needs credentials, contracts or review before it can be turned on.

| Feature | Status | What's needed | Where in code |
|---|---|---|---|
| **MongoDB hosting** | Required | A MongoDB 7+ cluster (e.g. Atlas) with auth, TLS, encryption at rest, backups. A BAA if HIPAA applies. | `MONGODB_URI` |
| **Transactional email** (password reset) | `console` mode logs "email queued" and does not deliver it | SMTP or an email API (SES, Postmark, SendGrid). A BAA if HIPAA applies. Implement `SmtpEmailSender.send` with nodemailer or the provider SDK. Set `EMAIL_PROVIDER=smtp` and `SMTP_*`. | `backend/src/services/email.ts` |
| **Password-reset deep link** | Users paste the code into the app | Configure universal links / app links, or a small web page, and set `PASSWORD_RESET_URL`. The `carecompass://` scheme is already set in `app.json`. | `mobile/app.json`, ResetPasswordScreen |
| **Verified provider directory** | Local, admin-verified collection. Seed data is **fictional demo data**. | A process and staff to verify providers (licence lookups, practice confirmation). Optionally the NPPES NPI Registry for names, specialties and addresses (no insurance or availability). Or a licensed directory vendor. | `services/providerDirectory.ts` (`NppesAdapter`, disabled), `/api/admin/providers` |
| **Insurance, language and telehealth data** | Hidden unless an admin marks it verified | A verified data source per attribute | `Provider.insuranceAccepted / languages / telehealth` |
| **Location search** | Matches on the 3-digit ZIP prefix | A geocoding service (e.g. Google, Mapbox, US Census geocoder) and a 2dsphere index for distance search | `routes/providers.ts` `buildFilter` |
| **Appointment booking** | Shows the provider's `bookingUrl` or phone. The app's tracker does **not** book anything. | A partner scheduling API (e.g. EHR or FHIR scheduling, a practice-management vendor) with a contract | `Provider.bookingUrl`, `routes/appointments.ts` |
| **Telehealth** | Not implemented | A HIPAA-capable video vendor with a BAA | add a hand-off from ProviderDetail |
| **Push notifications** (appointment reminders, new messages) | Reminder time is stored; nothing is sent | Expo Push / APNs / FCM credentials. Don't put health details in notification text. | `Appointment.reminderMinutesBefore` |
| **Clinician identity verification** | Manual admin approval (`/api/admin/clinicians/:id/verify`) | A verification process (NPI and state licence checks, an identity-proofing vendor) | `routes/admin.ts` |
| **Error monitoring** | Not included | A vendor that supports PII scrubbing and a BAA. Make sure no request bodies or health data are sent. | `app.ts` |
| **AI explanation layer** | Disabled (`AI_PROVIDER=disabled`) | See below | `config/env.ts` |
| **Translation** | English only | Professional medical translation and review | UI strings, questionnaire definition |

## AI explanation layer (optional)

The app works fully without AI. If it's added later, the brief's guardrails apply:

- Use it only to rephrase **verified** resources in plain language, summarise the user's own entries, draft questions for appointments, or help with directory navigation.
- The deterministic triage result is computed first and **always wins**. AI text can't change the care level, warnings or next steps, and must be shown separately from them.
- Never diagnose, predict, prescribe, reassure about concerning symptoms, or invent references or credentials. Always cite the curated source.
- Don't send identifiable health data to an AI provider without explicit consent, a BAA or DPA, and a privacy review. Prefer sending de-identified text.
- Log prompts and outputs for safety review, without identifiers.
