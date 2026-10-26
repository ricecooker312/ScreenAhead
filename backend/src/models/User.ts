import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

export const ROLES = ['patient', 'clinician', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ONBOARDING_CATEGORIES = [
  'diagnosed',
  'symptoms',
  'increased_risk',
  'screening_prevention',
  'in_treatment',
  'survivor',
  'supporting_someone',
  'other_concern',
] as const;

const consentSchema = new Schema(
  {
    type: { type: String, enum: ['terms', 'privacy', 'health_data', 'clinician_sharing'], required: true },
    version: { type: String, required: true },
    grantedAt: { type: Date, required: true },
    revokedAt: { type: Date },
  },
  { _id: false },
);

const clinicianSchema = new Schema(
  {
    credentials: { type: String, trim: true, maxlength: 120 }, // e.g. "MD, FACS"
    specialty: { type: String, trim: true, maxlength: 120 },
    organization: { type: String, trim: true, maxlength: 200 },
    npi: { type: String, trim: true, match: /^\d{10}$/ },
    verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    verifiedAt: { type: Date },
    verificationSource: { type: String, maxlength: 300 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, trim: true, maxlength: 80 },
    role: { type: String, enum: ROLES, default: 'patient', index: true },
    status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
    onboardingCategories: [{ type: String, enum: ONBOARDING_CATEGORIES }],
    onboardingComplete: { type: Boolean, default: false },
    settings: {
      preferredLanguage: { type: String, default: 'en', maxlength: 10 },
      largeText: { type: Boolean, default: false },
      reduceMotion: { type: Boolean, default: false },
      showDefinitions: { type: Boolean, default: true },
    },
    consents: [consentSchema],
    clinician: clinicianSchema,
    // Contact phone the patient may choose to share with connected clinicians.
    contactPhone: { type: String, trim: true, maxlength: 30 },
    tokenVersion: { type: Number, default: 0 }, // bump to revoke all access tokens
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.passwordHash;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  },
});

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);
