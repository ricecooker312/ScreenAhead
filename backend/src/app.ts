import fs from 'fs';
import path from 'path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { env, isProd } from './config/env';
import { logger } from './config/logger';
import { sanitizeInput } from './middleware/sanitize';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { healthProfileRouter } from './routes/healthProfile';
import { questionnairesRouter } from './routes/questionnaires';
import { symptomsRouter } from './routes/symptoms';
import { triageRouter, recommendationsRouter } from './routes/triage';
import { providersRouter } from './routes/providers';
import { resourcesRouter } from './routes/resources';
import { appointmentsRouter } from './routes/appointments';
import { connectionsRouter } from './routes/connections';
import { adminRouter } from './routes/admin';
import { dashboardRouter } from './routes/dashboard';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(helmet());
  const origins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins.length ? origins : false, credentials: false }));

  // Redirect plain HTTP in production (expects a TLS-terminating proxy that sets X-Forwarded-Proto).
  if (isProd) {
    app.use((req, res, next) => (req.secure ? next() : res.status(400).json({ error: { code: 'HTTPS_REQUIRED', message: 'Use HTTPS' } })));
  }

  app.use(
    pinoHttp({
      logger,
      // Log method, path and status only. No bodies, no query strings (they can contain health terms).
      serializers: {
        req: (req) => ({ method: req.method, url: String(req.url).split('?')[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(sanitizeInput);
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store'); // never cache health data
    next();
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  if (env.ENABLE_API_DOCS || !isProd) {
    const spec = YAML.parse(fs.readFileSync(path.join(__dirname, '..', 'openapi', 'openapi.yaml'), 'utf8'));
    app.get('/api/openapi.json', (_req, res) => res.json(spec));
    app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(spec));
  }

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/health-profile', healthProfileRouter);
  app.use('/api/questionnaires', questionnairesRouter);
  app.use('/api/symptoms', symptomsRouter);
  app.use('/api/triage', triageRouter);
  app.use('/api/recommendations', recommendationsRouter);
  app.use('/api/providers', providersRouter);
  app.use('/api/resources', resourcesRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/connections', connectionsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
