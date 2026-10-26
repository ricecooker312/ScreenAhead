# Deployment

## Backend

### Build and run with Docker

```bash
cd backend
docker build -t carecompass-api .
docker run -p 4000:4000 --env-file .env.production carecompass-api
```

The image is multi-stage, runs as a non-root user, and has a health check on `GET /health`.

### Production configuration checklist

- `NODE_ENV=production`
- `TRUST_PROXY=true`, running behind a TLS-terminating load balancer or ingress that sets `X-Forwarded-Proto`. Plain-HTTP requests are refused.
- `JWT_ACCESS_SECRET`: at least 48 random bytes, from a secret manager (AWS Secrets Manager, GCP Secret Manager, Vault). Never in the image.
- `MONGODB_URI`: a managed cluster with auth, TLS, encryption at rest, private networking, backups and point-in-time restore.
- `CORS_ORIGINS`: empty unless a web client exists.
- `ENABLE_API_DOCS=false` (or protect `/api/docs`).
- `EMAIL_PROVIDER=smtp` with credentials, after implementing the sender (see EXTERNAL_SERVICES.md).
- `LOG_LEVEL=info`, sending stdout JSON to a log store with access controls and retention.
- Run 2 or more replicas. The API is stateless. Rate limits are per instance; for strict global limits, use a shared store (e.g. Redis via `rate-limit-redis`).

### Database initialization

```bash
NODE_ENV=production MONGODB_URI=... JWT_ACCESS_SECRET=... npm run seed:prod-safe   # indexes + educational resources only
```

`npm run seed` refuses to create demo providers or demo accounts when `NODE_ENV=production`.

Create the first admin by registering normally, then promoting the user in the database:

```js
db.users.updateOne({ email: "admin@yourorg" }, { $set: { role: "admin" } })
```

### Operations

- **Health:** `GET /health`
- **Logs:** structured JSON (pino). Request bodies are never logged.
- **Audit:** `GET /api/admin/audit-logs` (admin only)
- **Graceful shutdown** on SIGTERM.
- **Index changes:** `npm run seed:prod-safe` runs `syncIndexes()`.

## Mobile

```bash
cd mobile
npm install -g eas-cli
eas build:configure
# set EXPO_PUBLIC_API_URL=https://api.yourdomain in eas.json (per profile) or EAS secrets
eas build --platform ios
eas build --platform android
eas submit
```

Before submitting:

- Set a real `bundleIdentifier` and `package` in `app.json`. The current values are placeholders.
- Complete the App Store privacy "nutrition label" and Google Play Data safety form to match PRIVACY_POLICY_DRAFT.md.
- Keep `android.allowBackup: false`, so health data isn't included in device backups.
- Set `EXPO_PUBLIC_EMERGENCY_NUMBER` for each launch country.

## CI

`.github/workflows/ci.yml` runs typecheck, unit tests, integration tests against a MongoDB service container, the backend build, the mobile tests and the Python tool tests.
