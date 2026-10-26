import { Request, Response, NextFunction } from 'express';
import { z, ZodType } from 'zod';
import { badRequest } from '../utils/errors';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Parsed, validated input. Handlers read from here, never from raw req.body/query. */
    valid: { body?: any; query?: any; params?: any };
  }
}

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.valid = req.valid ?? {};
    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key] ?? {});
      if (!result.success) {
        return next(
          badRequest(
            'Some information is missing or not valid',
            result.error.issues.map((i) => ({ field: [key, ...i.path].join('.'), message: i.message })),
          ),
        );
      }
      req.valid[key] = result.data;
    }
    next();
  };
}

export { z };
