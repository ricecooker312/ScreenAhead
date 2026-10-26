import { Schema, model, Types } from 'mongoose';

export const SPECIALTIES = [
  'medical_oncology',
  'gastroenterology',
  'colorectal_surgery',
  'surgical_oncology',
  'radiation_oncology',
  'genetic_counseling',
  'primary_care',
  'oncology_nursing_navigation',
  'oncology_dietitian',
  'mental_health',
  'rehabilitation_survivorship',
] as const;

/** An attribute that is shown to users only if it has been verified. */
const verifiedList = new Schema(
  { values: [{ type: String, trim: true, maxlength: 80 }], verified: { type: Boolean, default: false }, verifiedAt: Date, source: String },
  { _id: false },
);
const verifiedBool = new Schema(
  { value: Boolean, verified: { type: Boolean, default: false }, verifiedAt: Date, source: String },
  { _id: false },
);

const providerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    credentials: { type: String, trim: true, maxlength: 120 },
    kind: { type: String, enum: ['individual', 'organization'], default: 'individual' },
    specialties: [{ type: String, enum: SPECIALTIES, required: true }],
    focusAreas: [{ type: String, trim: true, maxlength: 120 }],
    organization: { type: String, trim: true, maxlength: 200 },
    location: {
      addressLine: { type: String, trim: true, maxlength: 200 },
      city: { type: String, trim: true, maxlength: 100 },
      state: { type: String, trim: true, maxlength: 50 },
      postalCode: { type: String, trim: true, maxlength: 12 },
      country: { type: String, trim: true, default: 'US', maxlength: 2 },
    },
    serviceArea: { type: String, trim: true, maxlength: 200 },
    contact: {
      phone: { type: String, trim: true, maxlength: 30 },
      email: { type: String, trim: true, maxlength: 254 },
    },
    website: { type: String, trim: true, maxlength: 500 },
    bookingUrl: { type: String, trim: true, maxlength: 500 },
    insuranceAccepted: verifiedList,
    languages: verifiedList,
    telehealth: verifiedBool,
    npi: { type: String, trim: true, match: /^\d{10}$/ },
    verification: {
      status: { type: String, enum: ['verified', 'unverified', 'demo'], default: 'unverified', index: true },
      source: { type: String, maxlength: 300 },
      lastVerifiedAt: { type: Date },
      verifiedBy: { type: Types.ObjectId, ref: 'User' },
    },
    isDemo: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
providerSchema.index({ specialties: 1, 'location.state': 1, 'location.postalCode': 1 });
providerSchema.index({ name: 'text', organization: 'text', focusAreas: 'text' });

export const ProviderModel = model('Provider', providerSchema);

const savedProviderSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    provider: { type: Types.ObjectId, ref: 'Provider', required: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: 'savedAt', updatedAt: false } },
);
savedProviderSchema.index({ user: 1, provider: 1 }, { unique: true });
export const SavedProviderModel = model('SavedProvider', savedProviderSchema);
