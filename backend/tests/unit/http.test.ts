/**
 * HTTP-level checks that do not need a database: routing, auth guards,
 * validation that runs before any query, headers, and OpenAPI coverage.
 */
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import YAML from 'yaml';
import { createApp } from '../../src/app';

const app = createApp();

describe('HTTP basics', () => {
  it('health check and security headers', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('unknown endpoints return a consistent 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each([
    ['get', '/api/users/me'],
    ['get', '/api/health-profile'],
    ['get', '/api/symptoms'],
    ['post', '/api/questionnaires'],
    ['post', '/api/triage/evaluate'],
    ['get', '/api/providers'],
    ['get', '/api/appointments'],
    ['get', '/api/connections'],
    ['get', '/api/dashboard'],
    ['get', '/api/admin/audit-logs'],
  ])('%s %s requires authentication', async (method, url) => {
    const res = await (request(app) as any)[method](url);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects invalid registration input before touching the database', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'bad', password: '1' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: any) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['body.email', 'body.password', 'body.acceptTerms']));
  });

  it('rejects malformed JSON safely', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{oops');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/SyntaxError|at .+:\d+/);
  });

  it('rejects oversized bodies', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
  });

  it('strips Mongo operators from bodies (login with $ne becomes a validation error)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  it('serves the OpenAPI document', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
  });
});

describe('OpenAPI coverage', () => {
  const spec = YAML.parse(fs.readFileSync(path.join(__dirname, '../../openapi/openapi.yaml'), 'utf8'));
  const appSrc = fs.readFileSync(path.join(__dirname, '../../src/app.ts'), 'utf8');
  const mounts = Object.fromEntries(Array.from(appSrc.matchAll(/app\.use\('(\/api\/[\w-]+)', (\w+)\)/g)).map((m) => [m[2], m[1]]));

  const routes: string[] = [];
  const dir = path.join(__dirname, '../../src/routes');
  for (const file of fs.readdirSync(dir)) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of src.matchAll(/(\w+Router)\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
      const prefix = mounts[m[1]];
      if (!prefix) continue;
      const p = (prefix + (m[3] === '/' ? '' : m[3])).replace(/:(\w+)/g, '{$1}');
      routes.push(`${m[2]} ${p}`);
    }
  }

  it('found the routes', () => expect(routes.length).toBeGreaterThan(40));

  it.each(routes)('%s is documented', (route) => {
    const [method, p] = route.split(' ');
    expect(spec.paths[p]).toBeDefined();
    expect(spec.paths[p][method]).toBeDefined();
  });
});
