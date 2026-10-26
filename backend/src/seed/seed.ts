/**
 * Database initialisation.
 *
 *   npm run seed                  → indexes + resources + demo providers + demo accounts (non-production only)
 *   npm run seed -- --resources-only → indexes + educational resources only (safe for production)
 *
 * Demo accounts and providers are refused when NODE_ENV=production.
 */
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../config/db';
import { env, isProd } from '../config/env';
import * as models from '../models';
import { EducationalResourceModel, ProviderModel, UserModel, HealthProfileModel } from '../models';
import { RESOURCES } from './data/resources';
import { DEMO_PROVIDERS } from './data/demoProviders';
import { hashPassword, CONSENT_VERSION } from '../routes/auth';

export const DEMO_PASSWORD = 'DemoPass2026';

export async function seed({ resourcesOnly = false } = {}) {
  // Make sure every collection and index exists.
  for (const m of Object.values(models)) {
    if (typeof m === 'function' && 'syncIndexes' in m) await (m as unknown as mongoose.Model<unknown>).syncIndexes();
  }

  for (const r of RESOURCES) {
    await EducationalResourceModel.updateOne(
      { slug: r.slug },
      { $set: { ...r, topics: [...r.topics], status: 'published', lastReviewedAt: new Date('2026-10-26'), reviewedBy: 'Pending clinical review' } },
      { upsert: true },
    );
  }
  console.log(`✓ ${RESOURCES.length} educational resources`);
  if (resourcesOnly) return;

  if (isProd) {
    console.log('Skipping demo providers and accounts in production.');
    return;
  }

  await ProviderModel.deleteMany({ isDemo: true });
  await ProviderModel.insertMany(
    DEMO_PROVIDERS.map((p) => ({ ...p, isDemo: true, verification: { status: 'demo', source: 'Demonstration data (fictional)' } })),
  );
  console.log(`✓ ${DEMO_PROVIDERS.length} DEMO providers (fictional, labelled in the app)`);

  const now = new Date();
  const consents = ['terms', 'privacy', 'health_data'].map((type) => ({ type, version: CONSENT_VERSION, grantedAt: now }));
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const accounts = [
    { email: 'patient@demo.carecompass.test', displayName: 'Demo Patient', role: 'patient', onboardingCategories: ['symptoms', 'increased_risk'], onboardingComplete: true },
    {
      email: 'clinician@demo.carecompass.test',
      displayName: 'Dr. Demo Clinician',
      role: 'clinician',
      onboardingComplete: true,
      clinician: { credentials: 'MD', specialty: 'Gastroenterology', organization: 'Demo Clinic (Sample)', verificationStatus: 'verified', verifiedAt: now, verificationSource: 'Demo seed — not a real verification' },
    },
    { email: 'admin@demo.carecompass.test', displayName: 'Demo Admin', role: 'admin', onboardingComplete: true },
  ];
  for (const a of accounts) {
    await UserModel.updateOne({ email: a.email }, { $set: { ...a, passwordHash, consents, status: 'active' } }, { upsert: true });
  }
  const patient = await UserModel.findOne({ email: accounts[0].email });
  await HealthProfileModel.updateOne(
    { user: patient!._id },
    { $setOnInsert: { user: patient!._id, age: 52, familyHistory: [{ relation: 'parent', condition: 'Colorectal cancer', ageAtDiagnosis: 61 }], postalCode: '62701' } },
    { upsert: true },
  );
  console.log(`✓ Demo accounts (password: ${DEMO_PASSWORD}):`);
  for (const a of accounts) console.log(`    ${a.role.padEnd(9)} ${a.email}`);
}

if (require.main === module) {
  const resourcesOnly = process.argv.includes('--resources-only');
  connectDb(env.MONGODB_URI)
    .then(() => seed({ resourcesOnly }))
    .then(disconnectDb)
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('Seed failed:', err.message);
      await disconnectDb();
      process.exit(1);
    });
}
