import os from 'os';
import mongoose from 'mongoose';
import request from 'supertest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../src/app';

/**
 * Integration tests need MongoDB. By default an in-memory server is started
 * (mongodb-memory-server downloads a mongod binary on first run). To use an
 * existing server instead, set MONGODB_TEST_URI, e.g.
 *   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/carecompass-test npm run test:integration
 */
let mem: MongoMemoryServer | undefined;

export const app = createApp();
export const api = () => request(app);

export async function startDb() {
  let uri = process.env.MONGODB_TEST_URI;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mem = await MongoMemoryServer.create();
    uri = mem.getUri('carecompass-test');
  }
  // MongoDB driver 7 loads `os` with a dynamic import(), which Jest's CommonJS sandbox
  // can't do; the handshake then fails with "Missing required sub-document 'driver'".
  await mongoose.connect(uri, { runtimeAdapters: { os } } as mongoose.ConnectOptions);
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

export async function stopDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mem?.stop();
}

export async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

let counter = 0;
export const PASSWORD = 'CorrectHorse42';

export async function registerPatient(extra: Record<string, unknown> = {}) {
  counter += 1;
  const res = await api()
    .post('/api/auth/register')
    .send({
      email: `patient${counter}-${Date.now()}@example.test`,
      password: PASSWORD,
      displayName: `Patient ${counter}`,
      acceptTerms: true,
      acceptPrivacy: true,
      consentHealthData: true,
      onboardingCategories: ['symptoms'],
      ...extra,
    });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken as string, refreshToken: res.body.refreshToken as string, user: res.body.user, email: res.body.user.email as string };
}

export async function registerClinician({ verified = true } = {}) {
  const c = await registerPatient({
    role: 'clinician',
    clinician: { credentials: 'MD', specialty: 'Gastroenterology', organization: 'Test Clinic' },
  });
  if (verified) {
    await mongoose.model('User').updateOne({ _id: c.user._id }, { 'clinician.verificationStatus': 'verified' });
  }
  return c;
}

export async function makeAdmin() {
  const a = await registerPatient();
  await mongoose.model('User').updateOne({ _id: a.user._id }, { role: 'admin' });
  return a;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
