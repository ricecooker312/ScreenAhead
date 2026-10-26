# Security and privacy

## Controls implemented

| Area | Implementation |
|---|---|
| Passwords | Argon2id (OWASP parameters: 19 MiB memory, 2 iterations). At least 10 characters, with letters and a number. |
| Sessions | 15-minute HS256 JWT access tokens (issuer-checked, algorithm pinned), plus 30-day opaque refresh tokens stored as SHA-256 hashes and rotated on every use. Reusing a token revokes the whole token family. `tokenVersion` bump revokes all access tokens (password reset, "sign out everywhere"). |
| Token storage (mobile) | Access token in memory only. Refresh token in iOS Keychain or Android Keystore via `expo-secure-store`. |
| Account recovery | Single-use reset token (hashed, 30-minute TTL), the same response whether or not the account exists, and all sessions revoked after reset. |
| Transport | HTTPS required in production: requests not marked secure by the proxy are refused. Set `TRUST_PROXY=true` behind a TLS terminator. |
| Headers | `helmet` defaults, `Cache-Control: no-store` on all API responses, `x-powered-by` removed. |
| Input | Strict Zod schemas on every body, query and params. Unknown fields rejected. 100 kB body limit. Keys starting with `$`, containing `.`, or named `__proto__` are stripped. Express 5's simple query parser prevents nested query objects. Regex inputs are escaped. |
| Output | Consistent error shape. No stack traces or internal messages returned. React Native renders text only (no HTML injection surface). |
| Rate limiting | 600 requests per 15 minutes per IP overall. 20 per 15 minutes on credential endpoints and share-code redemption. |
| Authorization | Every patient query is scoped by `user`. Records owned by someone else return 404. Role middleware on each router. Clinicians need admin verification. Patient-controlled, scope-limited, revocable connections. |
| Logging | pino logs method, path and status only. No bodies or query strings. Keys like `password`, `token`, `answers` and `authorization` are redacted. |
| Audit | `auditlogs` records registration, password resets, exports, deletions, connection events, clinician summary and message views, and all admin actions. It never stores health content. |
| Data minimization | All health-profile fields are optional, with a "why we ask" note. Medical record uploads aren't required (and aren't supported yet). |
| User rights | Export all data (`GET /api/users/me/export`). Delete the account and all health data (`DELETE /api/users/me`, password confirmation). |
| No ads or analytics | No analytics or advertising SDKs are included (see `app.json` → `extra.privacyNote`). |

## Data retention

| Data | Retention |
|---|---|
| Account and health data | Until the user deletes it. Recommended: an inactive-account policy, e.g. notify after 24 months, then delete. Not yet automated. |
| Refresh tokens | TTL index deletes them at expiry (30 days). |
| Password reset tokens | TTL index (30 minutes). |
| Share codes | Expire after `SHARE_CODE_TTL_HOURS`. Codes are hashed and cleared when used or revoked. |
| Audit logs | TTL `AUDIT_LOG_RETENTION_DAYS` (default 6 years, matching common HIPAA documentation retention). Confirm with counsel. |
| Backups | Configure in your MongoDB host. Deletion requests must also age out of backups within a documented window. |

## Regulatory considerations (not legal advice)

- **HIPAA (US):** applies if CareCompass is operated by, or on behalf of, a covered entity, or if the operator becomes a business associate (e.g. when clinicians use it to communicate with their patients). If so, you need:
  - a risk analysis,
  - BAAs with the hosting, database, email and logging vendors,
  - workforce training,
  - breach procedures, and
  - access reviews.

  If it's offered directly to consumers, the FTC Health Breach Notification Rule may apply instead.
- **US state laws:** e.g. Washington My Health My Data Act, California CCPA/CPRA, Connecticut and Nevada consumer health data laws. These cover consent for collection and sharing, deletion rights and geofencing limits.
- **International:** GDPR and UK GDPR treat health data as special category data. That needs explicit consent, a DPIA, data residency and DPO considerations.
- **Medical device regulation:** symptom triage software may be regulated in some markets. See CLINICAL_REVIEW.md.

**No compliance is claimed.** A legal, organizational and technical review is required.

## Recommended before launch

- An independent penetration test and code review (OWASP MASVS for mobile, ASVS for the API).
- MongoDB with authentication, TLS, encryption at rest, IP allow-listing and least-privilege users.
- Secrets in a managed secret store, with JWT secret rotation (support two keys during rotation).
- Field-level encryption for the most sensitive fields (e.g. genetic results, free-text notes) using MongoDB CSFLE or Queryable Encryption.
- Certificate pinning in the mobile app, plus jailbreak/root heuristics as appropriate.
- Account lockout or step-up checks after repeated failures, and optional MFA (required for clinicians and admins).
- Automated dependency scanning (`npm audit`, Dependabot) and container image scanning.
- Alerting on audit-log anomalies (e.g. a clinician viewing many summaries).
