import pino from 'pino';
import { env, isProd } from './env';

/**
 * Structured logger. Health data, credentials and tokens must never reach logs:
 * request bodies are not logged at all, and known sensitive keys are redacted
 * defensively in case they are passed in a log object.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.newPassword',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
      '*.answers',
      '*.healthProfile',
      'password',
      'token',
      'refreshToken',
    ],
    censor: '[REDACTED]',
  },
  transport: !isProd && env.LOG_LEVEL !== 'silent' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});
