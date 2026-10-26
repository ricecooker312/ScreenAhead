import { api, startDb, stopDb, clearDb, registerPatient, PASSWORD, auth } from './setup';
import { consoleOutbox } from '../../src/services/email';
import { UserModel, RefreshTokenModel } from '../../src/models';

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

describe('registration', () => {
  it('creates an account with hashed password and consent records', async () => {
    const { user, token } = await registerPatient();
    expect(user.passwordHash).toBeUndefined();
    const stored = await UserModel.findById(user._id).select('+passwordHash').lean();
    expect(stored!.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored!.consents.map((c) => c.type)).toEqual(expect.arrayContaining(['terms', 'privacy', 'health_data']));
    const me = await api().get('/api/users/me').set(auth(token));
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(user.email);
  });

  it('requires explicit consent', async () => {
    const res = await api().post('/api/auth/register').send({ email: 'a@example.test', password: PASSWORD, acceptTerms: true, acceptPrivacy: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects weak passwords and bad emails', async () => {
    const base = { acceptTerms: true, acceptPrivacy: true, consentHealthData: true };
    expect((await api().post('/api/auth/register').send({ ...base, email: 'a@example.test', password: 'short' })).status).toBe(400);
    expect((await api().post('/api/auth/register').send({ ...base, email: 'not-an-email', password: PASSWORD })).status).toBe(400);
  });

  it('rejects duplicate emails', async () => {
    const { email } = await registerPatient();
    const res = await api()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, acceptTerms: true, acceptPrivacy: true, consentHealthData: true });
    expect(res.status).toBe(409);
  });

  it('clinician accounts start as pending verification', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({
        email: 'doc@example.test',
        password: PASSWORD,
        role: 'clinician',
        clinician: { credentials: 'MD', specialty: 'Oncology' },
        acceptTerms: true,
        acceptPrivacy: true,
        consentHealthData: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.user.clinician.verificationStatus).toBe('pending');
  });

  it('cannot self-register as admin', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ email: 'x@example.test', password: PASSWORD, role: 'admin', acceptTerms: true, acceptPrivacy: true, consentHealthData: true });
    expect(res.status).toBe(400);
  });
});

describe('login, refresh and logout', () => {
  it('logs in with correct credentials and gives the same error for wrong password and unknown email', async () => {
    const { email } = await registerPatient();
    expect((await api().post('/api/auth/login').send({ email, password: PASSWORD })).status).toBe(200);
    const wrong = await api().post('/api/auth/login').send({ email, password: 'WrongPass99' });
    const unknown = await api().post('/api/auth/login').send({ email: 'nobody@example.test', password: 'WrongPass99' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const { refreshToken } = await registerPatient();
    const first = await api().post('/api/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(refreshToken);
    // Re-using the old token revokes the whole family, including the new one.
    expect((await api().post('/api/auth/refresh').send({ refreshToken })).status).toBe(401);
    expect((await api().post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken })).status).toBe(401);
  });

  it('stores refresh tokens only as hashes', async () => {
    const { refreshToken } = await registerPatient();
    expect(await RefreshTokenModel.exists({ tokenHash: refreshToken })).toBeNull();
  });

  it('logout revokes the refresh token', async () => {
    const { token, refreshToken } = await registerPatient();
    expect((await api().post('/api/auth/logout').set(auth(token)).send({ refreshToken })).status).toBe(204);
    expect((await api().post('/api/auth/refresh').send({ refreshToken })).status).toBe(401);
  });

  it('logout-all invalidates existing access tokens', async () => {
    const { token } = await registerPatient();
    await api().post('/api/auth/logout-all').set(auth(token));
    expect((await api().get('/api/users/me').set(auth(token))).status).toBe(401);
  });

  it('rejects missing, malformed and tampered tokens', async () => {
    const { token } = await registerPatient();
    expect((await api().get('/api/users/me')).status).toBe(401);
    expect((await api().get('/api/users/me').set({ Authorization: 'Bearer nope' })).status).toBe(401);
    expect((await api().get('/api/users/me').set(auth(token.slice(0, -2) + 'xx'))).status).toBe(401);
  });
});

describe('password reset', () => {
  it('sends a reset link, accepts it once, and signs out other sessions', async () => {
    const { email, refreshToken } = await registerPatient();
    const before = consoleOutbox().length;
    const res = await api().post('/api/auth/forgot-password').send({ email });
    expect(res.status).toBe(200);
    const mail = consoleOutbox()[before];
    const token = /token=([\w-]+)/.exec(mail.text)![1];

    const reset = await api().post('/api/auth/reset-password').send({ token, newPassword: 'BrandNewPass77' });
    expect(reset.status).toBe(200);
    expect((await api().post('/api/auth/reset-password').send({ token, newPassword: 'AnotherPass88' })).status).toBe(400);
    expect((await api().post('/api/auth/login').send({ email, password: 'BrandNewPass77' })).status).toBe(200);
    expect((await api().post('/api/auth/refresh').send({ refreshToken })).status).toBe(401);
  });

  it('gives the same response for unknown emails', async () => {
    const res = await api().post('/api/auth/forgot-password').send({ email: 'ghost@example.test' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account exists/);
  });
});
